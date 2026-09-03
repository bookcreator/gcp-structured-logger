'use strict'

/**
 * Emits `src/**\/*.d.ts` from the JSDoc annotations using `tsconfig.build.json`.
 *
 * The hand-written `index.d.ts` imports its logger types from `./src/*`, so
 * without these files consumers see those imports as `any` (or as errors when
 * `skipLibCheck` is off). They are generated on `prepack`, gitignored, and
 * published through the `files` field of `package.json`.
 */
const { spawnSync } = require('node:child_process')
const { readdirSync, rmSync } = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const srcDir = path.join(root, 'src')

/** @param {string} extension */
const listSources = (extension) => readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
   .filter(file => file.endsWith(extension))
   .map(file => path.join(srcDir, file))

function main() {
   // Remove previous output first: tsc prefers a `.d.ts` over the `.js` beside it
   // when resolving imports and would then refuse to overwrite it (TS5055).
   for (const file of listSources('.d.ts')) rmSync(file)

   const tsc = spawnSync(process.execPath, [require.resolve('typescript/lib/tsc.js'), '-p', 'tsconfig.build.json'], { cwd: root, stdio: 'inherit' })
   if (tsc.status !== 0) return tsc.status ?? 1

   const emitted = listSources('.d.ts')
   const missing = listSources('.js').map(file => file.replace(/\.js$/, '.d.ts')).filter(file => !emitted.includes(file))
   if (missing.length > 0) {
      console.error(`No declarations were emitted for: ${missing.map(file => path.relative(root, file)).join(', ')}`)
      return 1
   }
   console.log(`Emitted ${emitted.length} declaration files into ${path.relative(root, srcDir)}/`)
   return 0
}

process.exitCode = main()
