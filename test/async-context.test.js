const { assert } = require('chai')
const { createSandbox } = require('sinon')

const sinon = createSandbox()

describe('async-context', function () {

   /** @type {import('../src/async-context')} */
   let ctx
   /** @type {InstanceType<import('../src/StructuredLogger')['StructuredLogger']>} */
   let loggerA
   /** @type {InstanceType<import('../src/StructuredLogger')['StructuredLogger']>} */
   let loggerB

   before(function () {
      ctx = require('../src/async-context')
      const { StructuredLogger } = require('../src/StructuredLogger')
      loggerA = new StructuredLogger('p', 'l', { service: 's' }, null, null)
      loggerB = new StructuredLogger('p', 'l', { service: 's' }, null, null)
   })

   after(function () {
      sinon.restore()
   })

   it('should be re-exported from the gcp-structured-logger/context subpath', function () {
      assert.strictEqual(require('../context'), ctx)
   })

   describe('#createLoggerContext', function () {

      it('should return independent runWithLogger/activeLogger functions', function () {
         const scope = ctx.createLoggerContext()
         assert.isFunction(scope.runWithLogger)
         assert.isFunction(scope.activeLogger)
      })

      it('should isolate scopes from one another', function () {
         const a = ctx.createLoggerContext()
         const b = ctx.createLoggerContext()

         a.runWithLogger(loggerA, () => {
            // b's scope is empty even while a's is active
            assert.strictEqual(a.activeLogger(), loggerA)
            assert.isUndefined(b.activeLogger())
            assert.strictEqual(b.activeLogger(loggerB), loggerB)
         })
      })

      it('should isolate the shared module scope from a fresh one', function () {
         const scope = ctx.createLoggerContext()
         scope.runWithLogger(loggerA, () => {
            // the shared subpath scope does not observe the fresh scope's logger
            assert.isUndefined(ctx.activeLogger())
         })
      })
   })

   describe('#activeLogger', function () {

      it('should return undefined outside any scope', function () {
         assert.isUndefined(ctx.activeLogger())
      })

      it('should return the fallback outside any scope', function () {
         assert.strictEqual(ctx.activeLogger(loggerA), loggerA)
      })
   })

   describe('#runWithLogger', function () {

      it('should make the logger active inside the scope', function () {
         ctx.runWithLogger(loggerA, () => {
            assert.strictEqual(ctx.activeLogger(), loggerA)
            assert.strictEqual(ctx.activeLogger(loggerB), loggerA)
         })
      })

      it('should return the callbacks return value', function () {
         assert.strictEqual(ctx.runWithLogger(loggerA, () => 42), 42)
      })

      it('should restore the previous state after the scope', function () {
         assert.isUndefined(ctx.activeLogger())
         ctx.runWithLogger(loggerA, () => { })
         assert.isUndefined(ctx.activeLogger())
      })

      it('should support nested scopes', function () {
         ctx.runWithLogger(loggerA, () => {
            assert.strictEqual(ctx.activeLogger(), loggerA)
            ctx.runWithLogger(loggerB, () => {
               assert.strictEqual(ctx.activeLogger(), loggerB)
            })
            assert.strictEqual(ctx.activeLogger(), loggerA)
         })
      })

      it('should persist across an await boundary', async function () {
         await ctx.runWithLogger(loggerA, async () => {
            assert.strictEqual(ctx.activeLogger(), loggerA)
            await Promise.resolve()
            assert.strictEqual(ctx.activeLogger(), loggerA)
         })
      })
   })
})
