/** @type {(keyof console)[]} */
const stubbedConsoleMethodsNames = [
   'log',
   'debug',
   'info',
   'warn',
   'error',
]
/** @type {sinon.SinonSpy<[...any], void>[]} */
const stubbedConsoleMethods = []

const sinon = require('sinon')

// Stub console methods
for (const m of stubbedConsoleMethodsNames) {
   const stubbed = sinon.fake().named(m)
   stubbedConsoleMethods.push(stubbed)
   sinon.replace(console, m, stubbed)
}

exports.mochaGlobalTeardown = () => {
   for (const m of stubbedConsoleMethods) {
      sinon.restore()
   }
}

exports.mochaHooks = {
   beforeEach() {
      for (const m of stubbedConsoleMethods) {
         m.resetHistory()
      }
   }
}
