const { assert } = require('chai')
const { createSandbox, match: sinonMatch } = require('sinon')
const { LogSeverity } = require('..')

const sinon = createSandbox()

describe('StructuredLogger', function () {
   /** @type {import('../src/StructuredLogger')} */
   let loggers
   /** @type {sinon.SinonStub<[], import('@google-cloud/error-reporting').ErrorReporting>} */
   let errorReporter
   /** @type {string} */
   let NODE_ENV
   /** @type {sinon.SinonFakeTimers} */
   let fakeTimers
   before(function () {
      loggers = require('../src/StructuredLogger')
      const { ErrorReporting } = require('@google-cloud/error-reporting')
      errorReporter = sinon.stub().returns(new ErrorReporting({
         reportMode: 'never',
         reportUnhandledRejections: false,
      }))
   })
   after(function () {
      sinon.restore()
   })
   beforeEach(function () {
      errorReporter.resetHistory();

      ({ NODE_ENV } = process.env)
   })
   afterEach(function () {
      if (NODE_ENV === undefined) {
         delete process.env.NODE_ENV
      } else {
         process.env.NODE_ENV = NODE_ENV
      }

      if (fakeTimers) fakeTimers.restore()
      fakeTimers = null
   })

   /** @type {Record<keyof InstanceType<loggers['StructuredLogger']>, keyof typeof LogSeverity>} */
   const methods = {
      log: LogSeverity.DEFAULT,
      debug: LogSeverity.DEBUG,
      info: LogSeverity.INFO,
      notice: LogSeverity.NOTICE,
      warn: LogSeverity.WARNING,
      error: LogSeverity.ERROR,
      critical: LogSeverity.CRITICAL,
      alert: LogSeverity.ALERT,
      emergency: LogSeverity.EMERGENCY,
   }

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

   const projectId = 'project-id'
   const logName = 'log-name'

   it('should create object', function () {
      const l = new loggers.StructuredLogger(projectId, logName, errorReporter, null)

      assert.propertyVal(l, '_projectId', projectId)
      assert.propertyVal(l, '_logName', logName)
      assert.deepPropertyVal(l, '_labels', { log_name: logName })
      sinon.assert.notCalled(errorReporter)
   })

   it('should create object with extra labels', function () {
      const labels = {
         hello: 'world'
      }
      const l = new loggers.StructuredLogger(projectId, logName, errorReporter, labels)

      assert.propertyVal(l, '_projectId', projectId)
      assert.propertyVal(l, '_logName', logName)
      assert.deepPropertyVal(l, '_labels', { log_name: logName, ...labels })
   })

   it('should create child logger with provided type', function () {
      const labels = {
         hello: 'world'
      }
      const type = 'TYPE'
      const l = new loggers.StructuredLogger(projectId, logName, errorReporter, labels).child(type)

      assert.instanceOf(l, loggers.StructuredLogger)
      assert.propertyVal(l, '_projectId', projectId)
      assert.propertyVal(l, '_logName', logName)
      assert.deepPropertyVal(l, '_labels', { log_name: logName, ...labels, type })
      sinon.assert.notCalled(errorReporter)
   })

   it('should create request logger', function () {
      const req = make()
      const l = new loggers.StructuredLogger(projectId, logName, errorReporter, null)._requestChild(req)

      assert.instanceOf(l, loggers.StructuredRequestLogger)
      assert.propertyVal(l, '_projectId', projectId)
      assert.propertyVal(l, '_logName', logName)
      assert.deepPropertyVal(l, '_labels', { log_name: logName, type: 'request' })
      // StructuredRequestLogger
      assert.propertyVal(l, '_errorReporter', errorReporter)
      assert.propertyVal(l, '_request', req)
      assert.isUndefined(l._extractUser)
      sinon.assert.notCalled(errorReporter)
   })

   it('should create request logger with extractUser', function () {
      const req = make()
      const extractUser = sinon.stub()
      const labels = {
         hello: 'world'
      }
      const l = new loggers.StructuredLogger(projectId, logName, errorReporter, labels)._requestChild(req, extractUser)

      assert.instanceOf(l, loggers.StructuredRequestLogger)
      assert.propertyVal(l, '_projectId', projectId)
      assert.propertyVal(l, '_logName', logName)
      assert.deepPropertyVal(l, '_labels', { log_name: logName, ...labels, type: 'request' })
      // StructuredRequestLogger
      assert.propertyVal(l, '_errorReporter', errorReporter)
      assert.propertyVal(l, '_request', req)
      assert.propertyVal(l, '_extractUser', extractUser)
      assert.property(l, '_trace')
   })

   it('should use same error reporter each time', function () {
      const l = new loggers.StructuredLogger(projectId, logName, errorReporter, null)

      const e1 = l._errorReporter()
      sinon.assert.calledOnceWithExactly(errorReporter)
      const e2 = l._errorReporter()
      sinon.assert.calledTwice(errorReporter)
      assert.strictEqual(e1, e2)
   })

   describe('Logging methods', function () {

      /** @type {InstanceType<loggers['StructuredLogger']>} */
      let logger
      /** @type {sinon.SinonSpy} */
      let writeSpy
      before(function () {
         logger = new loggers.StructuredLogger(projectId, logName, errorReporter, null)
         writeSpy = sinon.spy(logger, '_write')
      })
      beforeEach(function () {
         writeSpy.resetHistory()
      })

      context('Severity', function () {

         for (const m in methods) {
            const severity = methods[m]

            describe(`#${m}`, function () {
               const consoleFn = require('../src/severity').CONSOLE_SEVERITY[severity]

               it(`should write as ${severity} severity`, function () {
                  const message = 'Hello'
                  logger[m](message)

                  sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch({ severity, timestamp: sinonMatch.date }), message)
               })

               it(`should output to console.${consoleFn.name}`, function () {
                  const message = 'Hello'
                  logger[m](message)

                  sinon.assert.calledOnceWithExactly(consoleFn, sinonMatch(message))
               })
            })
         }

         describe('Formatted output', function () {
            const severity = LogSeverity.DEFAULT

            it('should output valid JSON object', function () {
               process.env.NODE_ENV = 'production'

               const timestamp = {
                  seconds: 1595578749,
                  nanos: 576000000
               }
               const timestampMS = 1595578749576
               fakeTimers = sinon.useFakeTimers({
                  now: timestampMS,
                  toFake: ['Date']
               })

               const circular = { blah: 1 }
               circular.circular = circular
               const date = new Date()
               const data = Buffer.from('Hello, world!', 'utf8')
               const message = 'hello'
               const data1 = { thing: 'world', blah: [/d/, date], base64: data }
               const data2 = { hello: 12, circular }

               logger.log(message, data1, data2)

               const consoleFn = require('../src/severity').CONSOLE_SEVERITY[severity]

               assert.deepStrictEqual(JSON.parse(consoleFn.lastCall.lastArg), {
                  '0': {
                     ...data1,
                     blah: [
                        {
                           '@type': 'RegExp',
                           source: 'd',
                           flags: ''
                        },
                        date.toISOString(),
                     ],
                     base64: {
                        '@type': 'Buffer',
                        length: data.length,
                        base64: data.toString('base64')
                     }
                  },
                  '1': {
                     ...data2,
                     circular: {
                        ...circular,
                        circular: '[Circular]'
                     }
                  },
                  severity,
                  message,
                  'logging.googleapis.com/labels': {
                     log_name: logName
                  },
                  timestamp
               })
            })

            it('should use only string argument', function () {
               const data = 'hello'

               logger.log(data)

               assert.deepStrictEqual(writeSpy.withArgs(sinonMatch({ severity })).lastCall.lastArg, data)
            })

            it('should concatenate only two string arguments', function () {
               const data = 'hello'

               logger.log(data, 'world')

               assert.deepStrictEqual(writeSpy.withArgs(sinonMatch({ severity })).lastCall.lastArg, data + ' world')
            })

            it('should use only argument', function () {
               const data = {}

               logger.log(data)

               assert.deepStrictEqual(writeSpy.withArgs(sinonMatch({ severity })).lastCall.lastArg, data)
            })

            it('should concatenate non-object arguments', function () {
               const date = new Date()
               const bigInt = '123432432432423432423'
               const args = ['hello', 'world', date, 1, false, true, 0, 1.2, /b\\o\n(o\))/ig, undefined, null, BigInt(bigInt)]

               logger.log(...args)

               assert.deepStrictEqual(writeSpy.withArgs(sinonMatch({ severity })).lastCall.lastArg, `hello world ${date.toISOString()} 1 false true 0 1.2 /b\\\\o\\n(o\\))/gi undefined null ${bigInt}`)
            })

            it('should concatenate non-object arguments up to first object', function () {
               const date = new Date()
               const bigInt = BigInt('123432432432423432423')
               const args = ['hello', 'world', date, 1, false, true, 0, { hello: 'world' }, 1.2, /b\\o\n(o\))/ig, undefined, null, bigInt]

               logger.log(...args)

               assert.deepStrictEqual(writeSpy.withArgs(sinonMatch({ severity })).lastCall.lastArg, { message: `hello world ${date.toISOString()} 1 false true 0`, ...[{ hello: 'world' }, 1.2, /b\\o\n(o\))/ig, undefined, null, bigInt] })
            })

            it('should use first argument as message and spread second arg if it does not contain a message property', function () {
               const message = 'hello'
               const data = { thing: 'world' }

               logger.log(message, data)

               assert.deepStrictEqual(writeSpy.withArgs(sinonMatch({ severity })).lastCall.lastArg, { message, ...data })
            })

            it('should use first argument as message and spread second arg', function () {
               const message = 'hello'
               const data = { message: 'world' }

               logger.log(message, data)

               assert.deepStrictEqual(writeSpy.withArgs(sinonMatch({ severity })).lastCall.lastArg, { message, '0': data })
            })

            it('should spread args when first arguement is not a string', function () {
               const args = [{ thing: 'hello', }, { message: 'world' }]

               logger.log(...args)

               assert.deepStrictEqual(writeSpy.withArgs(sinonMatch({ severity })).lastCall.lastArg, { ...args })
            })

            it('should use ignore objects eventTime as timestamp if invalid', function () {
               const data = {
                  eventTime: 'hello'
               }
               const timestamp = new Date()
               fakeTimers = sinon.useFakeTimers({
                  now: timestamp,
                  toFake: ['Date']
               })

               logger.log(data)

               assert.deepStrictEqual(writeSpy.withArgs(sinonMatch({ severity, timestamp })).lastCall.lastArg, data)
            })

            it('should use first argument as message and spread second Array arg', function () {
               const message = 'hello'
               const data = ['world']

               logger.log(message, data)

               assert.deepStrictEqual(writeSpy.withArgs(sinonMatch({ severity })).lastCall.lastArg, { message, '0': data[0] })
            })

            it('should use first argument as message and spread second Buffer arg', function () {
               const message = 'hello'
               const data = Buffer.from('world', 'utf8')

               logger.log(message, data)

               assert.deepStrictEqual(writeSpy.withArgs(sinonMatch({ severity })).lastCall.lastArg, { message, ...data })
            })

            it('should use first argument as message and spread second Set arg', function () {
               const message = 'hello'
               const data = new Set(['world'])

               logger.log(message, data)

               assert.deepStrictEqual(writeSpy.withArgs(sinonMatch({ severity })).lastCall.lastArg, { message, '0': data })
            })

            it('should use first argument as message and spread second Map arg', function () {
               const message = 'hello'
               const data = new Map()
               data.set(1, 'world')
               data.set('boo', 'hello')
               data.set({ key: 'thing' }, 'blah')

               logger.log(message, data)

               assert.deepStrictEqual(writeSpy.withArgs(sinonMatch({ severity })).lastCall.lastArg, { message, '0': data })
            })
         })

         context('NODE_ENV=production', function () {
            let consoleFn
            before(function () {
               consoleFn = require('../src/severity').CONSOLE_SEVERITY[LogSeverity.DEFAULT]
            })
            beforeEach(function () {
               process.env.NODE_ENV = 'production'
            })

            it('should fallback to LogSeverity.DEFAULT if invalid severity is provided', function () {
               const severity = LogSeverity.DEFAULT

               logger._write({ timestamp: new Date() }, '')

               assert.deepInclude(JSON.parse(consoleFn.lastCall.lastArg), { severity })
            })

            it('should spread non-conflicting arguments', function () {
               const message = 'message'
               const messageData = {
                  severity__: LogSeverity.WARNING,
               }

               logger.log(message, messageData)

               assert.deepInclude(JSON.parse(consoleFn.lastCall.lastArg), messageData)
            })

            it('should wrap conflicting arguments in messageData object when data has conflicting property names', function () {
               const message = 'message'
               const messageData = {
                  severity: LogSeverity.WARNING,
               }

               logger.log(message, messageData)

               assert.deepInclude(JSON.parse(consoleFn.lastCall.lastArg), { messageData })
            })
         })
      })

      describe('#reportError', function () {

         const ARGS = {
            'null': null,
            'undefined': undefined,
            'false': false,
            'empty array': []
         }

         afterEach('should get error reporter on each call', function () {
            sinon.assert.calledOnceWithExactly(errorReporter)
         })

         for (const arg in ARGS) {

            it(`should allow ${arg}`, function () {
               logger.reportError(ARGS[arg])

               sinon.assert.calledOnce(writeSpy)
            })
         }

         it('should use ERROR severity by default', function () {
            const error = new Error()
            logger.reportError(error)

            sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch({ severity: LogSeverity.ERROR }), sinonMatch.object)

            // Should remove context
            assert.notProperty(writeSpy.withArgs(sinonMatch({ severity: LogSeverity.ERROR })).firstCall.lastArg, 'context')
         })

         it('should use provided severity', function () {
            const error = new Error()
            logger.reportError(error, LogSeverity.EMERGENCY)

            sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch({ severity: LogSeverity.EMERGENCY }), sinonMatch.object)
         })

         it('should use provided errors severity', function () {
            const error = new Error()
            error.severity = LogSeverity.ALERT
            logger.reportError(error)

            sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch({ severity: LogSeverity.ALERT }), sinonMatch.object)
         })

         it('should clean up stack trace generated by ErrorReporting', function () {
            logger.reportError('Error string')

            const data = writeSpy.lastCall.lastArg

            assert.notInclude(data.message, '/src/StructuredLogger.js')
         })

         it('should use include errors enumerable keys', function () {
            const error = new Error()
            error.property = 'Hello'
            logger.reportError(error)

            sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch.object, sinonMatch({ error: { property: 'Hello' } }))
         })

         it('should use include errors enumerable keys (with Error value)', function () {
            const error = new Error()
            error.property = 'Hello'
            error.originalError = new Error('Underlying error')
            logger.reportError(error)

            sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch.object, sinonMatch({
               error: {
                  property: 'Hello',
                  originalError: sinonMatch.same(error.originalError)
               }
            }))
         })

         it('should include error.user on context', function () {
            const USER = 'A_USER'
            const error = new Error()
            error.user = USER
            logger.reportError(error)

            // Check we've logged error including user
            const data = writeSpy.withArgs(sinonMatch({ severity: LogSeverity.ERROR })).firstCall.lastArg
            assert.notNestedProperty(data, 'context.reportLocation')
            assert.notNestedProperty(data, 'context.httpRequest')
            assert.nestedPropertyVal(data, 'context.user', USER)
         })
      })
   })

   context('StructuredRequestLogger', function () {

      /** @type {InstanceType<loggers['StructuredLogger']>} */
      let logger
      before(function () {
         logger = new loggers.StructuredLogger(projectId, logName, errorReporter, null)
      })

      it('should include trace for request (NODE_ENV!=production)', function () {
         const traceId = '59973d340da5c40f77349df948ef7531'
         const spanId = 288377245651

         const req = make({ headers: { 'x-cloud-trace-context': `${traceId}/${spanId}` } })
         const log = logger._requestChild(req, errorReporter)

         const method = 'log'
         const severity = methods[method]
         const consoleFn = require('../src/severity').CONSOLE_SEVERITY[severity]
         log[method]('Some message')

         sinon.assert.calledOnceWithExactly(consoleFn, sinonMatch(traceId))
      })

      it('should include trace for request (NODE_ENV=production)', function () {
         process.env.NODE_ENV = 'production'

         const traceId = '59973d340da5c40f77349df948ef7531'
         const spanId = 288377245651

         const req = make({ headers: { 'x-cloud-trace-context': `${traceId}/${spanId}` } })
         const log = logger._requestChild(req, errorReporter)

         const method = 'log'
         const severity = methods[method]
         const consoleFn = require('../src/severity').CONSOLE_SEVERITY[severity]
         log[method]('Some message')

         assert.deepInclude(JSON.parse(consoleFn.lastCall.lastArg), {
            'logging.googleapis.com/trace': `projects/${projectId}/traces/${traceId}`
         })
      })

      describe('#reportError', function () {

         afterEach('should get error reporter on each call', function () {
            sinon.assert.calledOnceWithExactly(errorReporter)
         })

         it('should clean up stack trace generated by ErrorReporting', function () {
            const req = make()
            const log = logger._requestChild(req)

            const writeSpy = sinon.spy(log, '_write')

            log.reportError('Error string')

            const data = writeSpy.lastCall.lastArg

            assert.notInclude(data.message, '/src/StructuredLogger.js')
         })

         it('should use extract user function', function () {
            const USER = 'A_USER'
            const req = make()
            const extractUser = sinon.stub().returns(USER)
            const log = logger._requestChild(req, extractUser)

            const writeSpy = sinon.spy(log, '_write')

            const error = new Error()
            log.reportError(error)

            sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch.object, sinonMatch({ context: sinonMatch({ user: USER }) }))
            assert.nestedProperty(writeSpy.withArgs(sinonMatch({ severity: LogSeverity.ERROR })).firstCall.lastArg, 'context.httpRequest')
            assert.nestedPropertyVal(writeSpy.withArgs(sinonMatch({ severity: LogSeverity.ERROR })).firstCall.lastArg, 'context.user', USER)

            sinon.assert.calledOnceWithExactly(extractUser, req)
         })

         it('should ignore user if extract user function returns no value', function () {
            const req = make()
            const extractUser = sinon.stub().returns('')
            const log = logger._requestChild(req, extractUser)

            const writeSpy = sinon.spy(log, '_write')

            const error = new Error()
            log.reportError(error)

            sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch.object, sinonMatch({ context: sinonMatch(ctx => !ctx.user && !ctx.reportLocation && ctx.httpRequest) }))

            sinon.assert.calledOnceWithExactly(extractUser, req)
         })
      })
   })
})