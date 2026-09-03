'use strict'

// The runtime side of the exports map: every target must exist. Resolved
// through package self-reference, like the TypeScript files beside this one.
const assert = require('node:assert/strict')

const root = require('gcp-structured-logger')
assert.equal(typeof root.Logging, 'function', 'Logging is not exported from the package root')
assert.equal(require('gcp-structured-logger/express').Logging, root.Logging, 'gcp-structured-logger/express does not load the package root')
