const { assert } = require('chai')
const { createSandbox, match: sinonMatch } = require('sinon')
const { LogSeverity } = require('..')

const sinon = createSandbox()

const SERVICE_CONTEXT = {
   service: 'SERVICE',
   version: 'VERSION',
}

const SUPPORTS_NATIVE_ERROR_CAUSE = (() => {
   const cause = {}
   return new Error('', { cause }).cause === cause
})()

describe('StructuredLogger', function () {
   /** @type {import('../src/StructuredLogger')} */
   let loggers
   /** @type {string} */
   let NODE_ENV
   /** @type {sinon.SinonFakeTimers} */
   let fakeTimers

   before(function () {
      loggers = require('../src/StructuredLogger')
   })

   after(function () {
      sinon.restore()
   })

   beforeEach(function () {
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
      const l = new loggers.StructuredLogger(projectId, logName, SERVICE_CONTEXT, null, null)

      assert.propertyVal(l, '_projectId', projectId)
      assert.propertyVal(l, '_logName', logName)
      assert.deepPropertyVal(l, '_serviceContext', SERVICE_CONTEXT)
      assert.propertyVal(l, '_productionTransport', null)
      assert.deepPropertyVal(l, '_labels', { log_name: logName })
   })

   it('should create object with provided production transport', function () {
      const productionTransport = () => { }
      const l = new loggers.StructuredLogger(projectId, logName, SERVICE_CONTEXT, productionTransport, null)

      assert.propertyVal(l, '_projectId', projectId)
      assert.propertyVal(l, '_logName', logName)
      assert.deepPropertyVal(l, '_serviceContext', SERVICE_CONTEXT)
      assert.propertyVal(l, '_productionTransport', productionTransport)
      assert.deepPropertyVal(l, '_labels', { log_name: logName })
   })

   it('should create object with extra labels', function () {
      const labels = {
         hello: 'world'
      }
      const l = new loggers.StructuredLogger(projectId, logName, SERVICE_CONTEXT, null, labels)

      assert.propertyVal(l, '_projectId', projectId)
      assert.propertyVal(l, '_logName', logName)
      assert.deepPropertyVal(l, '_serviceContext', SERVICE_CONTEXT)
      assert.deepPropertyVal(l, '_labels', { log_name: logName, ...labels })
   })

   it('should create child logger with provided type', function () {
      const productionTransport = () => { }
      const labels = {
         hello: 'world'
      }
      const type = 'TYPE'
      const l = new loggers.StructuredLogger(projectId, logName, SERVICE_CONTEXT, productionTransport, labels).child(type)

      assert.instanceOf(l, loggers.StructuredLogger)
      assert.propertyVal(l, '_projectId', projectId)
      assert.propertyVal(l, '_logName', logName)
      assert.deepPropertyVal(l, '_serviceContext', SERVICE_CONTEXT)
      assert.deepPropertyVal(l, '_serviceContext', SERVICE_CONTEXT)
      assert.propertyVal(l, '_productionTransport', productionTransport)
      assert.deepPropertyVal(l, '_labels', { log_name: logName, ...labels, type })
   })

   it('should create request logger', function () {
      const productionTransport = () => { }
      const req = make()
      const l = new loggers.StructuredLogger(projectId, logName, SERVICE_CONTEXT, productionTransport, null)._requestChild(req)

      assert.instanceOf(l, loggers.StructuredRequestLogger)
      assert.propertyVal(l, '_projectId', projectId)
      assert.propertyVal(l, '_logName', logName)
      assert.deepPropertyVal(l, '_serviceContext', SERVICE_CONTEXT)
      assert.propertyVal(l, '_productionTransport', productionTransport)
      assert.deepPropertyVal(l, '_labels', { log_name: logName, type: 'request' })
      // StructuredRequestLogger
      assert.propertyVal(l, '_request', req)
      assert.isUndefined(l._extractUser)
   })

   it('should create request logger with extractUser', function () {
      const productionTransport = () => { }
      const req = make()
      const extractUser = sinon.stub()
      const labels = {
         hello: 'world'
      }
      const l = new loggers.StructuredLogger(projectId, logName, SERVICE_CONTEXT, productionTransport, labels)._requestChild(req, extractUser)

      assert.instanceOf(l, loggers.StructuredRequestLogger)
      assert.propertyVal(l, '_projectId', projectId)
      assert.propertyVal(l, '_logName', logName)
      assert.deepPropertyVal(l, '_serviceContext', SERVICE_CONTEXT)
      assert.propertyVal(l, '_productionTransport', productionTransport)
      assert.deepPropertyVal(l, '_labels', { log_name: logName, ...labels, type: 'request' })
      // StructuredRequestLogger
      assert.propertyVal(l, '_request', req)
      assert.propertyVal(l, '_extractUser', extractUser)
      assert.property(l, '_trace')
   })

   describe('Logging methods', function () {

      /** @type {InstanceType<loggers['StructuredLogger']>} */
      let logger
      /** @type {sinon.SinonSpy} */
      let writeSpy

      before(function () {
         logger = new loggers.StructuredLogger(projectId, logName, SERVICE_CONTEXT, null, null)
         writeSpy = sinon.spy(logger, '_write')
      })

      beforeEach(function () {
         writeSpy.resetHistory()
         logger._times.clear()
      })

      context('Severity', function () {

         for (const m in methods) {
            const severity = methods[m]

            describe(`#${m}`, function () {
               const consoleFn = require('../src/severity').CONSOLE_SEVERITY[severity]

               it(`should write as ${severity} severity`, function () {
                  const message = 'Hello'
                  logger[m](message)

                  sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch({ severity, timestamp: sinonMatch.typeOf('bigint') }), message)
               })

               it(`should output to console.${consoleFn.name}`, function () {
                  const message = 'Hello'
                  logger[m](message)

                  sinon.assert.calledOnceWithExactly(consoleFn, sinonMatch(message))
               })
            })
         }

         describe(`#timeLog`, function () {
            const LABEL = 'LABEL'

            /** @type {bigint} */
            let start

            beforeEach(function () {
               start = process.hrtime.bigint()
               logger._times.set(LABEL, start)
            })

            it('should write as DEFAULT severity', function () {
               const message = 'Hello'
               logger.timeLog(LABEL, message)

               sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch({ severity: 'DEFAULT', timestamp: sinonMatch.typeOf('bigint') }), sinonMatch(new RegExp(`^${LABEL}: \\d+?\\.\\d{3}(m|µ|n)?s ${message}$`)))
            })

            it(`should output to console.log`, function () {
               const message = 'Hello'
               logger.timeLog(LABEL, message)

               // eslint-disable-next-line no-console
               sinon.assert.calledOnceWithExactly(console.log, sinonMatch(message))
            })
         })

         describe('Formatted output', function () {
            const severity = LogSeverity.DEFAULT

            it('should output valid JSON object', function () {
               process.env.NODE_ENV = 'production'

               const { BOOT_NS, hrToTimestamp } = require('../src/hr-time')
               const timestampMS = 1595578749576
               fakeTimers = sinon.useFakeTimers({
                  toFake: ['hrtime']
               })
               fakeTimers.tick(timestampMS)

               const circular = { blah: 1 }
               circular.circular = circular
               const date = new Date()
               const data = Buffer.from('Hello, world!', 'utf8')
               const message = 'hello'
               const data1 = { thing: 'world', blah: [/d/, date], base64: data }
               const data2 = { hello: 12, circular, bigint: BigInt(1000000) }

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
                     },
                     bigint: '1000000',
                  },
                  severity,
                  message,
                  'logging.googleapis.com/labels': {
                     log_name: logName
                  },
                  timestamp: hrToTimestamp(BOOT_NS + process.hrtime.bigint()),
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

               assert.deepStrictEqual(writeSpy.withArgs(sinonMatch({ severity, timestamp: sinonMatch.typeOf('bigint') })).lastCall.lastArg, data)
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

         describe('NODE_ENV=production', function () {

            context('without productionTransport', function () {
               let consoleFn
               before(function () {
                  consoleFn = require('../src/severity').CONSOLE_SEVERITY[LogSeverity.DEFAULT]
               })
               beforeEach(function () {
                  process.env.NODE_ENV = 'production'
               })

               it('should fallback to LogSeverity.DEFAULT if invalid severity is provided', function () {
                  const severity = LogSeverity.DEFAULT

                  logger._write({ timestamp: 0n }, '')

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

            context('with productionTransport', function () {

               const productionTransport = sinon.spy(/** @type {import('../').Transport} */_entry => { })
               before(function () {
                  logger = new loggers.StructuredLogger(projectId, logName, SERVICE_CONTEXT, productionTransport, null)
                  writeSpy = sinon.spy(logger, '_write')
               })
               beforeEach(function () {
                  process.env.NODE_ENV = 'production'
                  productionTransport.resetHistory()
               })

               it('should include serialised timestamp', function () {
                  const severity = LogSeverity.DEBUG
                  const timestamp = 1617182524522000000n

                  logger._write({ timestamp, severity }, '')

                  sinon.assert.calledOnceWithExactly(productionTransport, sinon.match({ timestamp: { seconds: 1617182524, nanos: 522000000 }, severity }), {})
               })

               it('should include logName', function () {
                  const severity = LogSeverity.DEBUG
                  const timestamp = 1617182524522000000n
                  const labels = { hello: 'world' }

                  logger._write({ timestamp, severity, labels }, '')

                  sinon.assert.calledOnceWithExactly(productionTransport, sinon.match({ timestamp: { seconds: 1617182524, nanos: 522000000 }, severity, logName }), {})
                  assert.deepPropertyVal(productionTransport.firstCall.firstArg, 'labels', labels)
               })

               it('should fallback to LogSeverity.DEFAULT if invalid severity is provided', function () {
                  const severity = LogSeverity.DEFAULT

                  logger._write({ timestamp: 0n }, '')

                  sinon.assert.calledOnceWithExactly(productionTransport, sinon.match({ severity }), {})
               })

               it('should use message as data parameter', function () {
                  const message = 'message'

                  logger._write({ timestamp: 0n }, message)

                  sinon.assert.calledOnceWithExactly(productionTransport, sinon.match({ severity: LogSeverity.DEFAULT }), message)
               })

               it('should allow non-conflicting entry arguments and spread data parameter', function () {
                  const data = {
                     message: 'message',
                     severity__: LogSeverity.WARNING,
                  }
                  const labels = { thing: 'blah' }

                  logger._write({ timestamp: 0n, labels }, data)

                  sinon.assert.calledOnceWithExactly(productionTransport, sinon.match({ severity: LogSeverity.DEFAULT, labels }), data)
               })

               it('should move conflicting entry arguments to data parameter', function () {
                  const data = {
                     message: 'message',
                     severity__: LogSeverity.WARNING,
                  }
                  const textPayload = 'blah'

                  logger._write({ timestamp: 0n, textPayload }, data)

                  sinon.assert.calledOnceWithExactly(productionTransport, sinon.match({ severity: LogSeverity.DEFAULT }), { ...data, textPayload })
               })

               it('should ignore conflicting entry message argument', function () {
                  const data = {
                     message: 'message',
                     severity__: LogSeverity.WARNING,
                  }

                  logger._write({ timestamp: 0n, message: 'blah' }, data)

                  sinon.assert.calledOnceWithExactly(productionTransport, sinon.match({ severity: LogSeverity.DEFAULT }), {
                     message: 'message',
                     severity__: LogSeverity.WARNING,
                  })
               })
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

         it('should not use provided errors severity if its not a proper severity', function () {
            const error = new Error()
            error.severity = 'FATAL'
            logger.reportError(error)

            sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch({ severity: LogSeverity.ERROR }), sinonMatch.object)
         })

         it('should include eventTime', function () {
            const { BOOT_NS } = require('../src/hr-time')
            fakeTimers = sinon.useFakeTimers({
               toFake: ['hrtime']
            })
            fakeTimers.tick(Date.now())

            logger.reportError('Error string')

            const data = writeSpy.lastCall.lastArg

            assert.deepStrictEqual(data.eventTime, BOOT_NS + fakeTimers.hrtime.bigint())
         })

         it('should generate stack trace', function () {
            const errorMessage = 'Error string'
            const obj = new Error(errorMessage)
            logger.reportError(errorMessage)

            // Remove second line of stack as it'll be the line above we expect
            const expectedStack = obj.stack.split('\n').filter((_, idx) => idx > 1).join('\n')

            const data = writeSpy.lastCall.lastArg

            const actualMessage = data.message.split('\n')[0]
            const actualCallSite = data.message.split('\n')[1]
            // Remove second line of stack as it'll be the line below we expect
            const actualStack = data.message.split('\n').filter((_, idx) => idx > 1).join('\n')

            assert.strictEqual(actualMessage, errorMessage)
            assert.include(actualCallSite, ` (${__filename}:`)
            assert.deepStrictEqual(actualStack, expectedStack)
            assert.notInclude(data.message, '/src/StructuredLogger.js')
         })

         it('should use Error stack trace', function () {
            const err = new Error('Error object')
            logger.reportError(err)

            const data = writeSpy.lastCall.lastArg

            assert.strictEqual(data.message, err.stack)
            assert.notInclude(data.message, '/src/StructuredLogger.js')
         })

         it('should generate stack trace for non-Error object', function () {
            const errorMessage = 'Object'
            const err = { message: errorMessage }
            const obj = new Error(errorMessage)
            logger.reportError(err)

            // Remove second line of stack as it'll be the line above we expect
            const expectedStack = obj.stack.split('\n').filter((_, idx) => idx > 1).join('\n')

            const data = writeSpy.lastCall.lastArg

            const actualMessage = data.message.split('\n')[0]
            const actualCallSite = data.message.split('\n')[1]
            // Remove second line of stack as it'll be the line below we expect
            const actualStack = data.message.split('\n').filter((_, idx) => idx > 1).join('\n')

            assert.strictEqual(actualMessage, errorMessage)
            assert.include(actualCallSite, ` (${__filename}:`)
            assert.deepStrictEqual(actualStack, expectedStack)
            assert.notInclude(data.message, '/src/StructuredLogger.js')
         })

         it('should generate stack trace for non-Error object with toString()', function () {
            const errorMessage = 'Object'
            const err = { message: 'MESSAGE:' + errorMessage, toString: () => errorMessage }
            const obj = new Error(errorMessage)
            logger.reportError(err)

            // Remove second line of stack as it'll be the line above we expect
            const expectedStack = obj.stack.split('\n').filter((_, idx) => idx > 1).join('\n')

            const data = writeSpy.lastCall.lastArg

            const actualMessage = data.message.split('\n')[0]
            const actualCallSite = data.message.split('\n')[1]
            // Remove second line of stack as it'll be the line below we expect
            const actualStack = data.message.split('\n').filter((_, idx) => idx > 1).join('\n')

            assert.strictEqual(actualMessage, errorMessage)
            assert.include(actualCallSite, ` (${__filename}:`)
            assert.deepStrictEqual(actualStack, expectedStack)
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

         it('should use include errors cause', function () {
            const cause = new Error('CAUSE')
            const error = SUPPORTS_NATIVE_ERROR_CAUSE ? new Error('TOP LEVEL', { cause }) : (() => {
               const e = new Error('TOP LEVEL')
               e.cause = cause
               return e
            })()
            logger.reportError(error)

            sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch.object, sinonMatch({ error: { cause } }))
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

         it('should include service context', function () {
            logger.reportError('Error')

            const data = writeSpy.lastCall.lastArg

            assert.deepNestedPropertyVal(data, 'serviceContext', SERVICE_CONTEXT)
         })

         it('should not include context', function () {
            logger.reportError('Error')

            const data = writeSpy.lastCall.lastArg

            assert.notProperty(data, 'context')
         })
      })

      describe('#assert', function () {

         const truthyValues = [
            true,
            1,
            -1,
            0.1,
            1n,
            'true',
            'hello',
            [],
            {},
         ]

         for (const value of truthyValues) {
            it(`should not log anything when expression is truthy [${value}]`, function () {
               logger.assert(value)

               sinon.assert.notCalled(writeSpy)
            })
         }

         const falsyValues = [
            false,
            0,
            0n,
            '',
            undefined,
            null
         ]

         for (const value of falsyValues) {
            it(`should log when expression is falsy [${value}]`, function () {
               logger.assert(value)

               sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch({ severity: LogSeverity.WARNING }), sinonMatch.any)
            })
         }

         it('should add assertion failure message when not arguments are provided', function () {
            logger.assert(false)

            sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch({ severity: LogSeverity.WARNING }), 'Assertion failed')
         })

         it('should prepend assertion failure message to arguments', function () {
            logger.assert(false, 'Hello, world!')

            sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch({ severity: LogSeverity.WARNING }), 'Assertion failed: Hello, world!')
         })
      })

      describe('#time*', function () {

         describe('#time', function () {

            it('should add new time label', function () {
               const LABEL = 'LABEL'

               logger.time(LABEL)

               assert.typeOf(logger._times.get(LABEL), 'bigint')
            })

            it('should stringify label parameter', function () {
               const LABEL = Symbol('Label')

               logger.time(LABEL)

               assert.typeOf(logger._times.get('Symbol(Label)'), 'bigint')
            })

            it('should log nothing with new label', function () {
               logger.time('NEW_LABEL')

               sinon.assert.notCalled(writeSpy)
            })

            it('should do nothing when label is already present', function () {
               const LABEL = 'LABEL'
               logger.time(LABEL)

               const value = logger._times.get(LABEL)
               assert.typeOf(value, 'bigint')
               sinon.assert.notCalled(writeSpy)

               logger.time(LABEL)
               sinon.assert.notCalled(writeSpy)
               assert.strictEqual(logger._times.get(LABEL), value)
            })
         })

         describe('#timeEnd', function () {

            it('should do nothing with unknown label', function () {
               logger.timeEnd()

               sinon.assert.notCalled(writeSpy)
            })

            it('should log time with known label', function () {
               const LABEL = 'LABEL'
               logger.time(LABEL)
               logger.timeEnd(LABEL)

               sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch({ severity: 'DEFAULT', timestamp: sinonMatch.typeOf('bigint') }), sinonMatch(new RegExp(`^${LABEL}: \\d+?(\\.\\d{3}[mµ]?|n)s$`)))
            })

            it('should remove time label', function () {
               const LABEL = 'LABEL'

               logger.time(LABEL)
               logger.timeEnd(LABEL)

               assert.isEmpty(logger._times.values())
            })
         })

         describe('#timeLog', function () {

            it('should include arguments', function () {
               const LABEL = 'LABEL'

               const date = new Date()
               const bigInt = '123432432432423432423'
               const args = ['hello', 'world', date, 1, false, true, 0, 1.2, /b\\o\n(o\))/ig, undefined, null, BigInt(bigInt)]

               logger.time(LABEL)
               logger.timeLog(LABEL, ...args)

               assert.match(writeSpy.withArgs(sinonMatch({ severity: 'DEFAULT' })).lastCall.lastArg, /^LABEL: (\d{3}ns|\d+?\.\d{3}(m|µ)?s) hello world \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z 1 false true 0 1\.2 \/b\\\\o\\n\(o\\\)\)\/gi undefined null 123432432432423432423$/)
            })
         })

         describe('#_formatDuration', function () {

            const tests = new Map([
               [0n, '0ns'],
               [1n, '1ns'],
               [999n, '999ns'],
               [1000n, '1.000µs'],
               [1001n, '1.001µs'],
               [9999n, '9.999µs'],
               [999999n, '999.999µs'],
               [1000000n, '1.000ms'],
               [1000001n, '1.000ms'],
               [1000499n, '1.000ms'],
               [1000500n, '1.001ms'],
               [9999001n, '9.999ms'],
               [9999999n, '10.000ms'],
               [999999001n, '999.999ms'],
               [999999999n, '1000.000ms'],
               [1000000000n, '1.000s'],
               [1000000001n, '1.000s'],
               [1000499999n, '1.000s'],
               [1000500000n, '1.001s'],
               [59999499999n, '59.999s'],
               [59999999999n, '60.000s'],
               [60000000000n, '1:00.000 (m:ss.SSS)'],
               [60000000001n, '1:00.000 (m:ss.SSS)'],
               [60000499999n, '1:00.000 (m:ss.SSS)'],
               [60000500000n, '1:00.001 (m:ss.SSS)'],
               [3599999000001n, '59:59.999 (m:ss.SSS)'],
               [3599999499999n, '59:59.999 (m:ss.SSS)'],
               [3599999999999n, '1:00:00.000 (h:mm:ss.SSS)'],
               [3600000000000n, '1:00:00.000 (h:mm:ss.SSS)'],
               [3600000000001n, '1:00:00.000 (h:mm:ss.SSS)'],
               [3600000499999n, '1:00:00.000 (h:mm:ss.SSS)'],
               [3600000500000n, '1:00:00.001 (h:mm:ss.SSS)'],
               [36000000000000n, '10:00:00.000 (h:mm:ss.SSS)'],
            ])
            for (const [ns, string] of tests) {
               it(`with value '${ns}', should produce string '${string}'`, function () {
                  assert.strictEqual(logger._formatDuration(ns), string)
               })
            }
         })
      })

      describe('#trace', function () {

         it('should add trace stack when no arguments are provided', function () {
            // Make sure calling points are same variable length
            const E = Error
            const L = logger
            const trace = {}
            E.captureStackTrace(trace)
            L.trace()

            // Remove header from default stack trace and increment line number of first match of this file
            const stack = /** @type {string} */(trace.stack).split('\n').slice(1).join('\n').replace(__filename, '__THIS_FILE__').replace(/(?<file>\(__THIS_FILE__):(?<line>\d+)(?<suffix>:\d+\))/, (..._args) => {
               const { line, suffix } = _args[_args.length - 1]
               return `(${__filename}:${Number(line) + 1}${suffix}`
            })

            sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch({ severity: LogSeverity.DEBUG }), 'Trace\n' + stack)
         })

         it('should append trace stack to arguments', function () {
            // Make sure calling points are same variable length
            const E = Error
            const L = logger
            const trace = {}
            E.captureStackTrace(trace)
            L.trace('Hello, world!')

            // Remove header from default stack trace and increment line number of first match of this file
            const stack = /** @type {string} */(trace.stack).split('\n').slice(1).join('\n').replace(__filename, '__THIS_FILE__').replace(/(?<file>\(__THIS_FILE__):(?<line>\d+)(?<suffix>:\d+\))/, (..._args) => {
               const { line, suffix } = _args[_args.length - 1]
               return `(${__filename}:${Number(line) + 1}${suffix}`
            })

            sinon.assert.calledOnceWithExactly(writeSpy, sinonMatch({ severity: LogSeverity.DEBUG }), 'Hello, world! \n' + stack)
         })
      })
   })

   context('StructuredRequestLogger', function () {

      /** @type {InstanceType<loggers['StructuredLogger']>} */
      let logger
      before(function () {
         logger = new loggers.StructuredLogger(projectId, logName, SERVICE_CONTEXT, null, null)
      })

      it('should include trace for request (NODE_ENV!=production)', function () {
         const traceId = '59973d340da5c40f77349df948ef7531'
         const spanId = 288377245651

         const req = make({ headers: { 'x-cloud-trace-context': `${traceId}/${spanId}` } })
         const log = logger._requestChild(req)

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
         const log = logger._requestChild(req)

         const method = 'log'
         const severity = methods[method]
         const consoleFn = require('../src/severity').CONSOLE_SEVERITY[severity]
         log[method]('Some message')

         assert.deepInclude(JSON.parse(consoleFn.lastCall.lastArg), {
            'logging.googleapis.com/trace': `projects/${projectId}/traces/${traceId}`
         })
      })

      describe('#child', function () {

         it('should return instance of StructuredRequestLogger', function () {
            const traceId = '59973d340da5c40f77349df948ef7531'
            const spanId = 288377245651

            const req = make({ headers: { 'x-cloud-trace-context': `${traceId}/${spanId}` } })
            const log = logger._requestChild(req)

            const l = log.child('CHILD')

            assert.instanceOf(l, loggers.StructuredRequestLogger)
            assert.propertyVal(l, '_projectId', projectId)
            assert.propertyVal(l, '_logName', logName)
            assert.deepPropertyVal(l, '_serviceContext', SERVICE_CONTEXT)
            assert.deepPropertyVal(l, '_labels', { log_name: logName, type: 'CHILD' })
         })

         it('should use parents trace', function () {
            const traceId = '59973d340da5c40f77349df948ef7531'
            const spanId = 288377245651

            const req = make({ headers: { 'x-cloud-trace-context': `${traceId}/${spanId}` } })
            const log = logger._requestChild(req)

            const l = log.child('CHILD')

            assert.deepPropertyVal(l, '_trace', log._trace)
         })
      })

      describe('#reportError', function () {

         it('should include eventTime', function () {
            const { BOOT_NS } = require('../src/hr-time')
            fakeTimers = sinon.useFakeTimers({
               toFake: ['hrtime']
            })
            fakeTimers.tick(Date.now())

            const log = logger._requestChild(make())

            const writeSpy = sinon.spy(log, '_write')

            log.reportError('Error string')

            const data = writeSpy.lastCall.lastArg

            assert.deepStrictEqual(data.eventTime, BOOT_NS + fakeTimers.hrtime.bigint())
         })

         it('should generate stack trace', function () {
            const log = logger._requestChild(make())

            const writeSpy = sinon.spy(log, '_write')

            const errorMessage = 'Error string'
            const obj = new Error(errorMessage)
            log.reportError(errorMessage)

            // Remove second line of stack as it'll be the line above we expect
            const expectedStack = obj.stack.split('\n').filter((_, idx) => idx > 1).join('\n')

            const data = writeSpy.lastCall.lastArg

            const actualMessage = data.message.split('\n')[0]
            const actualCallSite = data.message.split('\n')[1]
            // Remove second line of stack as it'll be the line below we expect
            const actualStack = data.message.split('\n').filter((_, idx) => idx > 1).join('\n')

            assert.strictEqual(actualMessage, errorMessage)
            assert.include(actualCallSite, ` (${__filename}:`)
            assert.deepStrictEqual(actualStack, expectedStack)
            assert.notInclude(data.message, '/src/StructuredLogger.js')
         })

         it('should use Error stack trace', function () {
            const log = logger._requestChild(make())

            const writeSpy = sinon.spy(log, '_write')

            const err = new Error('Error object')
            log.reportError(err)

            const data = writeSpy.lastCall.lastArg

            assert.strictEqual(data.message, err.stack)
            assert.notInclude(data.message, '/src/StructuredLogger.js')
         })

         it('should generate stack trace for non-Error object', function () {
            const log = logger._requestChild(make())

            const writeSpy = sinon.spy(log, '_write')

            const errorMessage = 'Error string'
            const err = { message: errorMessage }
            const obj = new Error(errorMessage)
            log.reportError(errorMessage)

            // Remove second line of stack as it'll be the line above we expect
            const expectedStack = obj.stack.split('\n').filter((_, idx) => idx > 1).join('\n')

            const data = writeSpy.lastCall.lastArg

            const actualMessage = data.message.split('\n')[0]
            const actualCallSite = data.message.split('\n')[1]
            // Remove second line of stack as it'll be the line below we expect
            const actualStack = data.message.split('\n').filter((_, idx) => idx > 1).join('\n')

            assert.strictEqual(actualMessage, errorMessage)
            assert.include(actualCallSite, ` (${__filename}:`)
            assert.deepStrictEqual(actualStack, expectedStack)
            assert.notInclude(data.message, '/src/StructuredLogger.js')
         })

         it('should generate stack trace for non-Error object with toString()', function () {
            const log = logger._requestChild(make())

            const writeSpy = sinon.spy(log, '_write')

            const errorMessage = 'Error string'
            const err = { message: 'MESSAGE: ' + errorMessage, toString: () => errorMessage }
            const obj = new Error(errorMessage)
            log.reportError(errorMessage)

            // Remove second line of stack as it'll be the line above we expect
            const expectedStack = obj.stack.split('\n').filter((_, idx) => idx > 1).join('\n')

            const data = writeSpy.lastCall.lastArg

            const actualMessage = data.message.split('\n')[0]
            const actualCallSite = data.message.split('\n')[1]
            // Remove second line of stack as it'll be the line below we expect
            const actualStack = data.message.split('\n').filter((_, idx) => idx > 1).join('\n')

            assert.strictEqual(actualMessage, errorMessage)
            assert.include(actualCallSite, ` (${__filename}:`)
            assert.deepStrictEqual(actualStack, expectedStack)
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

         it('should include service context', function () {
            const log = logger._requestChild(make())

            const writeSpy = sinon.spy(log, '_write')

            log.reportError('Error string')

            const data = writeSpy.lastCall.lastArg

            assert.deepNestedPropertyVal(data, 'serviceContext', SERVICE_CONTEXT)
         })

         it('should include context', function () {
            const method = 'POST'
            const url = 'http://localhost:3000/path'
            const userAgent = 'some-user-agent'
            const referrer = 'http://localhost:3001/website'
            const ips = ['127.0.0.1', '30.0.0.0']
            const statusCode = 400

            const req = make({ method, originalUrl: url, ips, headers: { 'user-agent': userAgent, referrer }, res: { statusCode } })
            const log = logger._requestChild(req)

            const writeSpy = sinon.spy(log, '_write')

            log.reportError('Error string')

            const data = writeSpy.lastCall.lastArg

            assert.deepNestedPropertyVal(data, 'context', {
               httpRequest: {
                  method,
                  url,
                  userAgent,
                  referrer,
                  remoteIp: ips[0],
                  responseStatusCode: statusCode,
               }
            })
         })
      })
   })
})