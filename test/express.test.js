const { Writable, finished: finishedCb } = require('stream')
const { ServerResponse } = require('http')
const { assert } = require('chai')
const { createSandbox, match: sinonMatch } = require('sinon')

const finished = require('util').promisify(finishedCb)
const sinon = createSandbox()

describe('express.js', function () {

   /** @type {import('../express')} */
   let express
   /** @type {InstanceType<import('..')['Logging']>} */
   let logging

   const projectId = 'project-id'
   const logName = 'log-name'
   const serviceContext = { service: 'test' }

   /** @param {object} obj */
   const make = (obj = { headers: {} }) => ({
      ...obj,
      get(key) {
         for (const name in this.headers) {
            if (typeof key === 'string' && key.toLowerCase() === name.toLowerCase()) {
               return this.headers[name]
            }
         }
      }
   })
   class MockResponse extends Writable {
      _write(chunk, encoding, callback) {
         callback()
      }
   }

   before(function () {
      express = require('../express')
   })

   beforeEach(function () {
      logging = new (require('..').Logging)({ projectId, logName, serviceContext })
   })

   after(function () {
      sinon.restore()
   })

   describe('#makeLoggingMiddleware', function () {

      it('should attach a StructuredRequestLogger as req.log and call next', function () {
         const resStub = sinon.createStubInstance(ServerResponse)
         const req = make({ res: resStub })
         const next = sinon.stub()

         express.makeLoggingMiddleware(logging)(req, resStub, next)

         assert.instanceOf(req.log, require('../src/StructuredLogger').StructuredRequestLogger)
         sinon.assert.calledOnceWithExactly(next)
      })

      it('should run the rest of the request inside runWithLogger when als is set', function () {
         const resStub = sinon.createStubInstance(ServerResponse)
         const req = make({ res: resStub })

         let activeInside
         express.makeLoggingMiddleware(logging, { als: true })(req, resStub, () => { activeInside = logging.activeLogger() })

         assert.strictEqual(activeInside, req.log)
         // resolves back to the base logger once outside the scope
         assert.strictEqual(logging.activeLogger(), logging.logger)
      })
   })

   describe('#makeErrorMiddleware', function () {

      it('should report errors after the response finishes', async function () {
         const res = new MockResponse()
         const req = make({ res })
         const next = sinon.stub()

         express.makeLoggingMiddleware(logging)(req, res, () => { })
         const writeSpy = sinon.spy(req.log, '_write')

         const error = new Error('Some error')
         express.makeErrorMiddleware(logging)(error, req, res, next)

         sinon.assert.calledOnceWithExactly(next, error)
         await finished(res.end())

         sinon.assert.calledWithExactly(writeSpy.withArgs(sinonMatch({ severity: require('..').LogSeverity.ERROR })), sinonMatch.object, sinonMatch({ message: sinonMatch(error.message) }))
      })

      it('should report 4xx errors as warnings', async function () {
         const res = new MockResponse()
         const req = make({ res })

         express.makeLoggingMiddleware(logging)(req, res, () => { })
         const writeSpy = sinon.spy(req.log, '_write')

         const error = new Error('Bad request')
         error.statusCode = 400
         express.makeErrorMiddleware(logging)(error, req, res, sinon.stub())

         await finished(res.end())

         sinon.assert.calledWithExactly(writeSpy.withArgs(sinonMatch({ severity: require('..').LogSeverity.WARNING })), sinonMatch.object, sinonMatch({ message: sinonMatch(error.message) }))
      })
   })
})
