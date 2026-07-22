const { execFileSync } = require('child_process')
const { appendFileSync, rmSync, existsSync } = require('fs')
const { join } = require('path')

const root = join(__dirname, '..')
const typesDir = join(root, 'types')

/*
 * Start from a clean output dir. Otherwise a second run makes `tsc` resolve the `import('./')`
 * self-references (in express.js/next.js) to the previous build's declarations via package.json
 * `types`, refuse to overwrite its own inputs (TS5055), and the augmentations below get appended
 * a second time — shipping stale, duplicated declarations.
 */
rmSync(typesDir, { recursive: true, force: true })

/*
 * Emit the published `.d.ts` from the JSDoc, then append the bits `tsc` can't produce.
 *
 * `tsc` emits declarations best-effort even when it reports the (tolerated) `checkJs` errors in
 * the JS sources, so its non-zero exit isn't fatal. We **capture** its output rather than letting
 * it spam every build/prepack/CI log with those tolerated errors (which would make the green
 * "Types" job look like it passed despite type errors). A genuine emit failure is caught below.
 */
let tscOutput = ''
try {
   execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.build.json'], { cwd: root, stdio: 'pipe' })
} catch (err) {
   tscOutput = `${err.stdout || ''}${err.stderr || ''}`
}

// Tolerated type errors still emit declarations; a genuine failure produces none — surface that loudly.
if (!existsSync(join(typesDir, 'index.d.ts'))) {
   process.stderr.write(tscOutput)
   throw new Error('Type declaration emit failed: types/index.d.ts was not produced')
}

/*
 * Things `tsc` can't emit from JSDoc:
 *  - the `StructuredLogger` type re-export (its name collides with the value import that the
 *    generated `types/index.d.ts` already contains, so it can't be a JSDoc `@typedef`)
 *  - the global `Express.Request.log` / `next/server` `NextRequest.log` augmentations
 *
 * Paths are relative to the appended file, which always lives directly under `types/`, so
 * `./src/StructuredLogger` resolves correctly.
 */
const expressRequestAugmentation = `declare global {
   namespace Express {
      interface Request {
         readonly log: StructuredRequestLogger
      }
   }
}
`

const nextRequestAugmentation = `declare module 'next/server' {
   interface NextRequest {
      readonly log: StructuredRequestLogger
   }
}
`

const importRequestLogger = `import type { StructuredRequestLogger } from './src/StructuredLogger'\n`

/*
 * `types/index.d.ts` already declares `StructuredRequestLogger` (from index.js's `@typedef`
 * re-export), so it must NOT import the name again — that would be a duplicate declaration
 * (TS2440/TS2300). It carries BOTH augmentations for back-compat: `Express.Request.log` and
 * `next/server` `NextRequest.log` (so the deprecated `logging.nextJSMiddleware(req)` keeps typing
 * `req.log` from the root import). The `next/server` augmentation has no `import 'next/server'`,
 * so it merges into `NextRequest` when `next` is installed but does NOT force `next` on consumers
 * who don't use it — this is what makes the root package framework-type-free without regressing.
 */
appendFileSync(join(typesDir, 'index.d.ts'), `\nexport type { StructuredLogger }\n${expressRequestAugmentation}${nextRequestAugmentation}`)

// The subpath declarations don't declare the request logger type, so they import it first.
appendFileSync(join(typesDir, 'express.d.ts'), `\n${importRequestLogger}${expressRequestAugmentation}`)
appendFileSync(join(typesDir, 'next.d.ts'), `\n${importRequestLogger}${nextRequestAugmentation}`)
