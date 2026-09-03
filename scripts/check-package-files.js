'use strict'

/**
 * Asserts that the files the `exports` map and `index.d.ts` depend on are in
 * the tarball `npm publish` would upload. Uses a dry-run pack listing, so a
 * `files` mistake fails here (that is how index.js once went missing).
 */
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { readdirSync } = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const listing = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], shell: process.platform === 'win32' })
const published = new Set(JSON.parse(listing)[0].files.map(file => file.path))

const expected = ['package.json', 'index.js', 'index.d.ts', 'express.d.ts']
for (const file of readdirSync(path.join(root, 'src'), { recursive: true, encoding: 'utf8' })) {
   if (!file.endsWith('.js')) continue
   const source = `src/${file.split(path.sep).join('/')}`
   expected.push(source, source.replace(/\.js$/, '.d.ts'))
}
const missing = expected.filter(file => !published.has(file))
assert.deepEqual(missing, [], `Missing from the package tarball: ${missing.join(', ')}`)
