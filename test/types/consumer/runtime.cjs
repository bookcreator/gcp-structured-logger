'use strict'

// The runtime side of the exports map: every target must exist. Resolved
// through package self-reference, like the TypeScript files beside this one.
const assert = require('node:assert/strict')

const root = require('gcp-structured-logger')
assert.equal(typeof root.Logging, 'function', 'Logging is not exported from the package root')
assert.equal(require('gcp-structured-logger/express').Logging, root.Logging, 'gcp-structured-logger/express does not load the package root')

// Deep requires that worked before the exports map existed
assert.equal(require('gcp-structured-logger/index.js'), root, 'gcp-structured-logger/index.js does not load the package root')
const severity = require('gcp-structured-logger/src/severity')
assert.equal(severity.LogSeverity, root.LogSeverity, 'gcp-structured-logger/src/severity is not the module the root uses')
assert.equal(require('gcp-structured-logger/src/severity.js'), severity, 'gcp-structured-logger/src/severity.js resolves differently from the extensionless path')
assert.equal(typeof require('gcp-structured-logger/package.json').version, 'string', 'gcp-structured-logger/package.json is not reachable')
