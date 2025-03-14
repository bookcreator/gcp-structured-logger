const { Writable, finished: finishedCb } = require('stream')
const { assert } = require('chai')
const { createSandbox, match: sinonMatch } = require('sinon')

// Can't yet use require('stream/promises') until we drop Node 14
const finished = require('util').promisify(finishedCb)

const sinon = createSandbox()

describe('index.js', function () {
   /** @type {import('..')} */
   let logger

   before(function () {
      logger = require('..')
   })

   after(function () {
      sinon.restore()
   })

   describe('Logging', function () {

      /** @param {Partial<import('express-serve-static-core').Request>} obj */
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

      const projectId = 'project-id'
      const logName = 'log-name'
      const serviceContext = {
         service: 'test'
      }

      it('should create object with basic properties', function () {
         assert.doesNotThrow(() => {
            new logger.Logging({
               projectId,
               logName,
               serviceContext,
            })
         })
      })

      it('should include provided extraLabels property', function () {
         const extraLabels = {
            label1: 'value1',
            label2: 'value2',
         }
         const l = new logger.Logging({
            projectId,
            logName,
            serviceContext,
            extraLabels,
         })
         assert.deepStrictEqual(l._extraLabels, extraLabels)
      })

      it('should add extractUser property', function () {
         const requestUserExtractor = {}
         const l = new logger.Logging({
            projectId,
            logName,
            requestUserExtractor,
         })
         assert.strictEqual(l._extractUser, requestUserExtractor)
      })

      it('should have StructuredLogger logger property', function () {
         const l = new logger.Logging({
            projectId,
            logName,
            serviceContext,
         })
         assert.instanceOf(l.logger, require('../src/StructuredLogger').StructuredLogger)
      })

      it('should use serviceContext property', function () {
         const serviceContext = {
            service: 'tests',
            version: 'debug'
         }
         const l = new logger.Logging({
            projectId,
            logName,
            serviceContext
         })
         assert.deepStrictEqual(l._serviceContext, serviceContext)
      })

      it('logger property should reuse productionTransport', function () {
         const productionTransport = () => { }
         const l = new logger.Logging({
            projectId,
            logName,
            serviceContext,
            productionTransport
         })
         assert.strictEqual(l.logger._productionTransport, productionTransport)
      })

      context('#makeLoggingMiddleware', function () {

         it('should return middleware function', function () {
            const l = new logger.Logging({
               projectId,
               logName,
               serviceContext,
            })

            assert.isFunction(l.makeLoggingMiddleware())
         })

         it('should attach log property', function () {
            const l = new logger.Logging({
               projectId,
               logName,
               serviceContext,
            })

            const m = l.makeLoggingMiddleware()

            const resStub = sinon.createStubInstance(require('http').ServerResponse)
            const req = make({ res: resStub })
            const nextStub = sinon.stub()

            m(req, resStub, nextStub)

            assert.instanceOf(req.log, require('../src/StructuredLogger').StructuredRequestLogger)
            sinon.assert.calledOnceWithExactly(nextStub)
         })

         it('should include extractUser parameter on log property', function () {
            const requestUserExtractor = sinon.stub()
            const l = new logger.Logging({
               projectId,
               logName,
               serviceContext,
               requestUserExtractor,
            })

            const m = l.makeLoggingMiddleware()

            const resStub = sinon.createStubInstance(require('http').ServerResponse)
            const req = make({ res: resStub })
            const nextStub = sinon.stub()

            m(req, resStub, nextStub)

            assert.nestedPropertyVal(req, 'log._extractUser', requestUserExtractor)
         })
      })

      context('#nextJSMiddleware', function () {

         /** @param {Partial<import('next/server').NextRequest>} obj */
         const make = ({ headers, ...obj } = { headers: {} }) => ({
            url: 'https://hello.com',
            method: 'GET',
            get headers() {
               return {
                  has(name) {
                     for (const n in headers) {
                        if (typeof name === 'string' && name.toLowerCase() === n.toLowerCase()) return true
                     }
                     return false
                  },
                  get(name) {
                     for (const n in headers) {
                        if (typeof name === 'string' && name.toLowerCase() === n.toLowerCase()) {
                           return headers[n]
                        }
                     }
                  }
               }
            }
         })

         it('should return void', function () {
            const l = new logger.Logging({
               projectId,
               logName,
               serviceContext,
            })
            const req = make()

            assert.isUndefined(l.nextJSMiddleware(req))
         })

         it('should attach log property', function () {
            const l = new logger.Logging({
               projectId,
               logName,
               serviceContext,
            })
            const req = make()

            l.nextJSMiddleware(req)

            assert.instanceOf(req.log, require('../src/StructuredLogger').StructuredRequestLogger)
         })

         it('should include extractUser parameter on log property', function () {
            const requestUserExtractor = sinon.stub()
            const l = new logger.Logging({
               projectId,
               logName,
               serviceContext,
               requestUserExtractor,
            })
            const req = make()

            l.nextJSMiddleware(req)

            assert.nestedPropertyVal(req, 'log._extractUser', requestUserExtractor)
         })
      })

      context('#makeErrorMiddleware', function () {

         const requestUserExtractor = () => { }
         /** @type {InstanceType<logger['Logging']>} */
         let l
         beforeEach(function () {
            l = new logger.Logging({
               projectId,
               logName,
               serviceContext,
               requestUserExtractor,
            })
         })

         it('should return middleware function', function () {
            assert.isFunction(l.makeErrorMiddleware())
         })

         it('should report errors', async function () {

            const res = new MockResponse()
            const req = make({ res })
            const nextStub = sinon.stub()

            const error = new Error('Some error')
            l.makeLoggingMiddleware()(req, res, () => { })
            const writeSpy = sinon.spy(req.log, '_write')
            const makeRequestLog = sinon.spy(l, '_makeRequestLog').withArgs(req)

            const m = l.makeErrorMiddleware()
            m(error, req, res, nextStub)

            sinon.assert.calledOnceWithExactly(nextStub, error)

            await finished(res.end())

            sinon.assert.calledWithExactly(writeSpy.withArgs(sinonMatch({ severity: logger.LogSeverity.ERROR })), sinonMatch.object, sinonMatch({ message: sinonMatch(error.message) }))

            // Ensure we don't call _makeRequestLog again after .log is added
            sinon.assert.notCalled(makeRequestLog)
         })

         it('should report errors if no logging middleware was added', async function () {

            const res = new MockResponse()
            const req = make({ res })
            const nextStub = sinon.stub()

            const error = new Error('Some error')

            const makeRequestLog = l._makeRequestLog.bind(l)
            const makeRequestLogStub = sinon.stub(l, '_makeRequestLog')
            makeRequestLogStub.callsFake(req => {
               const reqLog = makeRequestLog(req)
               sinon.spy(reqLog, '_write')
               return reqLog
            })

            const m = l.makeErrorMiddleware()
            m(error, req, res, nextStub)

            sinon.assert.calledOnceWithExactly(nextStub, error)

            await finished(res.end())

            // Check we haven't added a req.log
            assert.notProperty(req, 'log')

            sinon.assert.calledOnceWithExactly(makeRequestLogStub, req)

            const writeSpy = makeRequestLogStub.withArgs(req).firstCall.returnValue._write
            sinon.assert.calledWithExactly(writeSpy.withArgs(sinonMatch({ severity: logger.LogSeverity.ERROR })), sinonMatch.object, sinonMatch({ message: sinonMatch(error.message) }))
            // Check we've included userExtractor
            assert.propertyVal(makeRequestLogStub.withArgs(req).firstCall.returnValue, '_extractUser', requestUserExtractor)
         })

         it('should report 4xx statusCode errors as warnings', async function () {

            const res = new MockResponse()
            const req = make({ res })
            const nextStub = sinon.stub()

            const error = new Error('Bad request')
            error.statusCode = 400
            l.makeLoggingMiddleware()(req, res, () => { })
            const writeSpy = sinon.spy(req.log, '_write')

            const m = l.makeErrorMiddleware()
            m(error, req, res, nextStub)

            sinon.assert.calledOnceWithExactly(nextStub, error)

            await finished(res.end())

            sinon.assert.calledWithExactly(writeSpy.withArgs(sinonMatch({ severity: logger.LogSeverity.WARNING })), sinonMatch.object, sinonMatch({ message: sinonMatch(error.message) }))
         })

         it('should report 4xx status errors as warnings', async function () {

            const res = new MockResponse()
            const req = make({ res })
            const nextStub = sinon.stub()

            const error = new Error('Not found')
            error.status = 404
            l.makeLoggingMiddleware()(req, res, () => { })
            const writeSpy = sinon.spy(req.log, '_write')

            const m = l.makeErrorMiddleware()
            m(error, req, res, nextStub)

            sinon.assert.calledOnceWithExactly(nextStub, error)

            await finished(res.end())

            sinon.assert.calledWithExactly(writeSpy.withArgs(sinonMatch({ severity: logger.LogSeverity.WARNING })), sinonMatch.object, sinonMatch({ message: sinonMatch(error.message) }))
         })
      })

      context('#attachToProcess', function () {

         /** @type {sinon.SinonSpy<Parameters<process['on']>, void>} */
         let processOnSpy
         /** @type {sinon.SinonSpy<Parameters<process['off']>, void>} */
         let processOffSpy
         before(function () {
            processOnSpy = sinon.spy(process, 'on')
            processOffSpy = sinon.spy(process, 'off')
         })
         after(function () {
            processOnSpy.restore()
            processOffSpy.restore()
         })
         beforeEach(function () {
            processOnSpy.resetHistory()
            processOffSpy.resetHistory()
         })
         let detach
         afterEach(function () {
            if (detach) detach()
            detach = null
         })

         it('should attach to process', function () {
            const l = new logger.Logging({
               projectId,
               logName,
               serviceContext,
            })
            detach = l.attachToProcess(l.logger)

            sinon.assert.calledTwice(processOnSpy)
            sinon.assert.calledWithExactly(processOnSpy, 'unhandledRejection', sinonMatch.func)
            sinon.assert.calledWith(processOnSpy, sinonMatch('uncaughtExceptionMonitor'), sinonMatch.func)


            const unhandledRejectionHandler = processOnSpy.withArgs('unhandledRejection').firstCall.lastArg
            const uncaughtExceptionHandler = processOnSpy.withArgs(sinonMatch('uncaughtExceptionMonitor')).firstCall.lastArg

            // Ensure they're different handlers
            assert.notStrictEqual(unhandledRejectionHandler, uncaughtExceptionHandler)
            // Ensure we've not removed them
            sinon.assert.notCalled(processOffSpy)
            assert.include(process.listeners('unhandledRejection'), unhandledRejectionHandler)
            assert.include(process.listeners('uncaughtExceptionMonitor'), uncaughtExceptionHandler)
         })

         it('should detach from process', function () {
            const l = new logger.Logging({
               projectId,
               logName,
               serviceContext,
            })
            l.attachToProcess(l.logger)()

            const unhandledRejectionHandler = processOnSpy.withArgs('unhandledRejection').firstCall.lastArg
            const uncaughtExceptionHandler = processOnSpy.withArgs(sinonMatch('uncaughtExceptionMonitor')).firstCall.lastArg

            sinon.assert.calledTwice(processOffSpy)
            sinon.assert.calledWithExactly(processOffSpy, 'unhandledRejection', unhandledRejectionHandler)
            sinon.assert.calledWith(processOffSpy, sinonMatch('uncaughtExceptionMonitor'), uncaughtExceptionHandler)

            // Ensure we've removed them
            assert.notInclude(process.listeners('unhandledRejection'), unhandledRejectionHandler)
            assert.notInclude(process.listeners('uncaughtExceptionMonitor'), uncaughtExceptionHandler)
         })

         it('should report unhandledRejections to logger', function () {
            const l = new logger.Logging({
               projectId,
               logName,
               serviceContext,
            })
            detach = l.attachToProcess(l.logger)

            const writeSpy = sinon.spy(l.logger, '_write')

            const unhandledRejectionHandler = processOnSpy.withArgs('unhandledRejection').firstCall.lastArg

            const reason = 'Unhandled rejection reason string'
            unhandledRejectionHandler(reason)

            // Check we've logged error
            sinon.assert.calledWithExactly(writeSpy.withArgs(sinonMatch({ severity: logger.LogSeverity.WARNING })), sinonMatch({ timestamp: sinonMatch.typeOf('bigint') }), sinonMatch({ message: sinonMatch(reason) }))
         })

         it('should report unhandledExceptions to logger', function () {
            const l = new logger.Logging({
               projectId,
               logName,
               serviceContext,
            })
            detach = l.attachToProcess(l.logger)

            const writeSpy = sinon.spy(l.logger, '_write')

            const uncaughtExceptionHandler = processOnSpy.withArgs(sinonMatch('uncaughtExceptionMonitor')).firstCall.lastArg

            const error = new Error('Some error')
            uncaughtExceptionHandler(error)

            // Check we've logged error
            sinon.assert.calledWithExactly(writeSpy.withArgs(sinonMatch({ severity: logger.LogSeverity.ERROR })), sinonMatch({ timestamp: sinonMatch.typeOf('bigint') }), sinonMatch({ message: sinonMatch(error.message) }))
         })
      })
   })

   describe('LogSeverity', function () {
      it('should expose object', function () {
         assert.strictEqual(logger.LogSeverity, require('../src/severity').LogSeverity)
      })

      it('should be readonly', function () {
         assert.isFrozen(logger.LogSeverity)
      })
   })

   describe('requestToHttpRequest', function () {
      it('should expose function', function () {
         assert.strictEqual(logger.requestToHttpRequest, require('../src/request-transformers').requestToHttpRequest)
      })
   })

   describe('extractTraceContext', function () {
      it('should expose function', function () {
         assert.strictEqual(logger.extractTraceContext, require('../src/trace-context').extractTraceContext)
      })
   })
})