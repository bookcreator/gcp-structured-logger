const { execFileSync } = require('child_process')
const { mkdtempSync, mkdirSync, readdirSync, copyFileSync, writeFileSync, symlinkSync, existsSync } = require('fs')
const { join } = require('path')
const { tmpdir } = require('os')

/*
 * Resolution + augmentation guard for the PUBLISHED package. `test/types/consumer.ts` maps imports
 * straight at the generated files via tsconfig `paths`, so it validates the .d.ts content but NOT
 * the package.json `exports`/`types`/`typesVersions` wiring. This builds a throwaway
 * `node_modules/gcp-structured-logger` from exactly the published files (peer deps symlinked from the
 * repo) and typechecks consumers through real module resolution. `noImplicitAny` makes a subpath that
 * resolves to JS-without-types fail (TS7016) rather than silently degrade to `any`.
 */
const root = join(__dirname, '..')
const tscBin = require.resolve('typescript/bin/tsc')

if (!existsSync(join(root, 'types', 'index.d.ts'))) {
   throw new Error('types/ not built — run `npm run build` first')
}

/** Recursive copy (fs.cpSync is still experimental on the supported Node 20 floor). */
function copyDir(from, to) {
   mkdirSync(to, { recursive: true })
   for (const entry of readdirSync(from, { withFileTypes: true })) {
      const src = join(from, entry.name)
      const dest = join(to, entry.name)
      if (entry.isDirectory()) copyDir(src, dest)
      else copyFileSync(src, dest)
   }
}

const tmp = mkdtempSync(join(tmpdir(), 'gsl-types-'))
const pkgDir = join(tmp, 'node_modules', 'gcp-structured-logger')
mkdirSync(pkgDir, { recursive: true })

// Mirror the published surface (the files that `exports`/`typesVersions` point at)
for (const f of ['package.json', 'index.js', 'express.js', 'next.js', 'context.js']) {
   copyFileSync(join(root, f), join(pkgDir, f))
}
for (const d of ['src', 'types']) {
   copyDir(join(root, d), join(pkgDir, d))
}
// Symlink the peer/ambient deps the framework subpaths reference, from the repo's install
for (const dep of ['@types', 'next', 'react']) {
   const from = join(root, 'node_modules', dep)
   if (existsSync(from)) symlinkSync(from, join(tmp, 'node_modules', dep), 'dir')
}

const resolutions = {
   node16: { module: 'node16', moduleResolution: 'node16' },
   node10: { module: 'commonjs', moduleResolution: 'node10' },
}

/*
 * skipLibCheck hides third-party lib-internal noise (Next's own .d.ts don't pass a strict node16
 * lib check); noImplicitAny makes a subpath that resolves to JS-without-types fail as TS7016. With
 * those, a correct consumer compiles with ZERO errors, so ANY non-zero tsc exit is a real failure
 * of our published wiring — TS2305 (missing export), TS2322/TS2345 (bad signatures), TS2307/TS7016
 * (resolution), TS2339 (missing augmentation), … — and we surface the full compiler output.
 */
const scenarios = [
   {
      label: 'subpath + src/* type resolution',
      // Every documented subpath, plus a src/* deep import (which must now carry declarations).
      // The extensionful `index.js` / `src/*.js` imports mirror the runtime-back-compat `exports`
      // entries: `exports` carries their types under node16, but node10 ignores `exports` and needs
      // matching `typesVersions` mappings — so both must resolve declarations in BOTH modes.
      src: `
import { Logging, LogSeverity } from 'gcp-structured-logger'
import { Logging as RootJsLogging } from 'gcp-structured-logger/index.js'
import { makeLoggingMiddleware, makeErrorMiddleware } from 'gcp-structured-logger/express'
import { nextJSMiddleware } from 'gcp-structured-logger/next'
import { runWithLogger, activeLogger, createLoggerContext } from 'gcp-structured-logger/context'
import { LogSeverity as DeepSeverity } from 'gcp-structured-logger/src/severity'
import { LogSeverity as DeepJsSeverity } from 'gcp-structured-logger/src/severity.js'
void Logging; void LogSeverity; void RootJsLogging; void makeLoggingMiddleware; void makeErrorMiddleware
void nextJSMiddleware; void runWithLogger; void activeLogger; void createLoggerContext; void DeepSeverity; void DeepJsSeverity
`,
      modes: ['node16', 'node10'],
   },
   {
      label: 'root import augments req.log (Express + Next back-compat)',
      // A bare root import must type `req.log` on BOTH framework requests without importing a subpath
      src: `
import 'gcp-structured-logger'
import type { NextRequest } from 'next/server'
import type { Request as ExpressRequest } from 'express-serve-static-core'
function nextMw(req: NextRequest) { req.log.info('next') }
function expressMw(req: ExpressRequest) { req.log.info('express') }
void nextMw; void expressMw
`,
      modes: ['node16'],
   },
]

let failed = false
for (const scenario of scenarios) {
   for (const modeName of scenario.modes) {
      const file = `${scenario.label.replace(/[^a-z0-9]+/gi, '-')}.${modeName}.ts`
      writeFileSync(join(tmp, file), scenario.src)
      const cfg = join(tmp, `tsconfig.${file}.json`)
      writeFileSync(cfg, JSON.stringify({
         compilerOptions: { noEmit: true, skipLibCheck: true, noImplicitAny: true, target: 'ES2022', ignoreDeprecations: '6.0', ...resolutions[modeName] },
         files: [file],
      }))
      try {
         execFileSync(process.execPath, [tscBin, '-p', cfg], { cwd: tmp, stdio: 'pipe' })
         process.stdout.write(`  ok [${modeName}] ${scenario.label}\n`)
      } catch (err) {
         failed = true
         process.stderr.write(`  x [${modeName}] ${scenario.label} — tsc reported errors:\n`)
         const out = `${err.stdout || ''}${err.stderr || ''}`
         for (const line of out.split('\n')) {
            if (line.trim()) process.stderr.write(`      ${line}\n`)
         }
      }
   }
}

if (failed) {
   process.stderr.write('Published-types check FAILED\n')
   process.exitCode = 1
} else {
   process.stdout.write('Published-types check OK\n')
}
