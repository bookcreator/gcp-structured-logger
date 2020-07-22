after(function restoreConsoleMethods() {
   require('sinon').restore()
})

beforeEach(function resetHistoryOfConsoleMethods() {
   for (const m in console) {
      // eslint-disable-next-line no-console
      const fn = console[m]
      if (typeof fn.resetHistory === 'function') {
         fn.resetHistory()
      }
   }
})

