// Stub console methods

/** @type {(keyof console)[]} */
const consoleMethods = [
   'log',
   'debug',
   'info',
   'warn',
   'error',
]

const sinon = require('sinon')

for (const m of consoleMethods) {
   sinon.replace(console, m, sinon.fake().named(m))
}
