const { inspect } = require('node:util')

const { assert } = require('chai')
const sinon = require('sinon')

const _cleanupForJSON = require('../src/cleanup-for-json')

/**
 * @param {any} obj
 * @param {Parameters<typeof _cleanupForJSON>[1]} [redactor]
 */
const cleanupForJSON = (obj, redactor = (_parentKey, value) => value) => _cleanupForJSON(obj, redactor)

describe('cleanup-for-json', function () {

   describe('Buffers', function () {
      it('should seralise to object', function () {
         const v = require('crypto').randomBytes(25)
         assert.deepStrictEqual(cleanupForJSON(v), {
            '@type': 'Buffer',
            length: v.length,
            base64: v.toString('base64')
         })
      })
   })

   describe('Dates', function () {
      it('should serialise to ISO string', function () {
         const v = new Date()
         assert.strictEqual(cleanupForJSON(v), v.toISOString())
      })
   })

   describe('RegExp', function () {
      it('should serialise literal to object', function () {
         const v = /abcde\(f/ig
         assert.deepStrictEqual(cleanupForJSON(v), {
            '@type': 'RegExp',
            source: 'abcde\\(f',
            flags: 'gi',
         })
      })

      it('should serialise constructed to object', function () {
         const v = new RegExp('abcde\\(f', 'mig')
         assert.deepStrictEqual(cleanupForJSON(v), {
            '@type': 'RegExp',
            source: 'abcde\\(f',
            flags: 'gim',
         })
      })
   })

   describe('Arrays', function () {
      it('should serialise to array with same order', function () {
         assert.sameDeepMembers(cleanupForJSON([1, 2, '3', false, true, 1.2]), [1, 2, '3', false, true, 1.2])
      })

      it('should serialise contents with same order', function () {
         const data = require('crypto').randomBytes(25)
         const date = new Date()
         assert.sameDeepMembers(cleanupForJSON([data, /abcde\(f/ig, date]), [{ '@type': 'Buffer', length: data.length, base64: data.toString('base64') }, { '@type': 'RegExp', source: 'abcde\\(f', flags: 'gi' }, date.toISOString()])
      })

      it('should replace circular references', function () {
         const v = [123]
         v.push(v)
         assert.sameDeepMembers(cleanupForJSON(v), [123, '[Circular]'])
      })
   })

   describe('Sets', function () {
      it('should serialise to array', function () {
         assert.deepStrictEqual(cleanupForJSON(new Set([1, 2, '3', false, true, 1.2])), [1, 2, '3', false, true, 1.2])
      })

      it('should serialise contents', function () {
         const data = require('crypto').randomBytes(25)
         const date = new Date()
         assert.deepStrictEqual(cleanupForJSON(new Set([data, /abcde\(f/ig, date])), [{ '@type': 'Buffer', length: data.length, base64: data.toString('base64') }, { '@type': 'RegExp', source: 'abcde\\(f', flags: 'gi' }, date.toISOString()])
      })

      it('should replace circular references', function () {
         const v = new Set([123])
         v.add(v)
         assert.deepStrictEqual(cleanupForJSON(v), [123, '[Circular]'])
      })
   })

   describe('Maps', function () {
      it('should serialise to object', function () {
         const v = new Map()
         v.set(1, '2')
         v.set('2', 2)
         v.set('hello', false)
         assert.deepStrictEqual(cleanupForJSON(v), [
            { key: 1, value: '2' },
            { key: '2', value: 2 },
            { key: 'hello', value: false },
         ])
      })

      it('should serialise values', function () {
         const data = require('crypto').randomBytes(25)
         const date = new Date()
         const v = new Map()
         v.set(1, /abcde\(f/ig)
         v.set('2', data)
         v.set('hello', date)
         assert.deepStrictEqual(cleanupForJSON(v), [
            { key: 1, value: { '@type': 'RegExp', source: 'abcde\\(f', flags: 'gi' } },
            { key: '2', value: { '@type': 'Buffer', length: data.length, base64: data.toString('base64') } },
            { key: 'hello', value: date.toISOString() },
         ])
      })

      it('should serialise keys', function () {
         const data = require('crypto').randomBytes(25)
         const date = new Date()
         const v = new Map()
         v.set(/abcde\(f/ig, 1)
         v.set(data, '2')
         v.set(date, 'hello')
         assert.deepStrictEqual(cleanupForJSON(v), [
            { key: { '@type': 'RegExp', source: 'abcde\\(f', flags: 'gi' }, value: 1 },
            { key: { '@type': 'Buffer', length: data.length, base64: data.toString('base64') }, value: '2' },
            { key: date.toISOString(), value: 'hello' },
         ])
      })

      it('should replace value circular references', function () {
         const v = new Map([['123', 123]])
         v.set('map', v)
         assert.deepStrictEqual(cleanupForJSON(v), [
            { key: '123', value: 123 },
            { key: 'map', value: '[Circular]' }
         ])
      })

      it('should replace key circular references', function () {
         const v = new Map([['123', 123]])
         v.set(v, 'map')
         assert.deepStrictEqual(cleanupForJSON(v), [
            { key: '123', value: 123 },
            { key: '[Circular]', value: 'map' }
         ])
      })
   })

   describe('Errors', function () {
      it('should serialise to object (base Error)', function () {
         const e = new Error('Some error')
         assert.deepStrictEqual(cleanupForJSON(e), {
            name: 'Error',
            stack: e.stack,
            message: e.message,
            cause: undefined,
         })
      })

      it('should serialise to object (Error subclass)', function () {
         const e = new TypeError('Some error')
         assert.deepStrictEqual(cleanupForJSON(e), {
            name: 'TypeError',
            stack: e.stack,
            message: e.message,
            cause: undefined,
         })
      })

      it('should serialise to object (Error prototype)', function () {
         const e = Object.create(Error.prototype)
         assert.deepStrictEqual(cleanupForJSON(e), {
            name: 'Error',
            stack: undefined,
            message: '',
            cause: undefined,
         })
      })

      it('should serialise to object (custom Error subclass)', function () {
         class CustomError extends Error { }
         const e = new CustomError('Some error')
         assert.deepStrictEqual(cleanupForJSON(e), {
            name: 'CustomError',
            stack: e.stack,
            message: e.message,
            cause: undefined,
         })
      })

      it('should serialise nested Error to object', function () {
         const err1 = new Error('Some error 1')
         const err2 = new Error('Some error 2')
         err2.code = 'ERROR_CODE'
         const err3 = new TypeError('Some error 3')
         const obj = {
            error: err1,
            array: [err2, err3]
         }
         assert.deepStrictEqual(cleanupForJSON(obj), {
            error: {
               name: 'Error',
               stack: err1.stack,
               message: err1.message,
               cause: undefined,
            },
            array: [
               {
                  name: 'Error',
                  stack: err2.stack,
                  message: err2.message,
                  cause: undefined,
                  code: err2.code,
               },
               {
                  name: 'TypeError',
                  stack: err3.stack,
                  message: err3.message,
                  cause: undefined,
               }
            ]
         })
      })

      it('should serialise Errors cause', function () {
         const cause = new Error('CAUSE')
         const error = new Error('TOP LEVEL', { cause })

         assert.deepStrictEqual(cleanupForJSON(error), {
            name: 'Error',
            stack: error.stack,
            message: error.message,
            cause: {
               name: 'Error',
               stack: cause.stack,
               message: cause.message,
               cause: undefined,
            }
         })
      })

      it('should serialise AggregateError errors', function () {
         const error = new AggregateError([new Error('SUB-ERROR1'), new Error('SUB-ERROR2')], 'TOP LEVEL')

         assert.deepStrictEqual(cleanupForJSON(error), {
            name: 'AggregateError',
            stack: error.stack,
            message: error.message,
            cause: undefined,
            errors: [
               {
                  name: 'Error',
                  stack: error.errors[0].stack,
                  message: error.errors[0].message,
                  cause: undefined,
               },
               {
                  name: 'Error',
                  stack: error.errors[1].stack,
                  message: error.errors[1].message,
                  cause: undefined,
               },
            ],
         })
      })

      it('should serialise custom AggregateError subclass', function () {
         class CustomAggregateError extends AggregateError {
            constructor() {
               super([new Error('SUB-ERROR1'), new Error('SUB-ERROR2')], 'TOP LEVEL')
               this.name = 'CustomAggregateError'
            }
         }
         const error = new CustomAggregateError()

         assert.deepStrictEqual(cleanupForJSON(error), {
            name: 'CustomAggregateError',
            stack: error.stack,
            message: error.message,
            cause: undefined,
            errors: [
               {
                  name: 'Error',
                  stack: error.errors[0].stack,
                  message: error.errors[0].message,
                  cause: undefined,
               },
               {
                  name: 'Error',
                  stack: error.errors[1].stack,
                  message: error.errors[1].message,
                  cause: undefined,
               },
            ],
         })
      })

      it('should serialise AggregateError cause errors', function () {
         const cause = new AggregateError([new Error('SUB-ERROR1'), new Error('SUB-ERROR2')], 'CAUSE')
         const error = new Error('TOP LEVEL', { cause })

         assert.deepStrictEqual(cleanupForJSON(error), {
            name: 'Error',
            stack: error.stack,
            message: error.message,
            cause: {
               name: 'AggregateError',
               stack: cause.stack,
               message: cause.message,
               cause: undefined,
               errors: [
                  {
                     name: 'Error',
                     stack: cause.errors[0].stack,
                     message: cause.errors[0].message,
                     cause: undefined,
                  },
                  {
                     name: 'Error',
                     stack: cause.errors[1].stack,
                     message: cause.errors[1].message,
                     cause: undefined,
                  },
               ],
            }
         })
      })

      context('Custom properties', function () {
         it('should serialise to object (base Error)', function () {
            const e = new Error('Some error')
            e.code = 'ERROR_CODE'
            assert.deepStrictEqual(cleanupForJSON(e), {
               name: 'Error',
               stack: e.stack,
               message: e.message,
               cause: undefined,
               code: e.code,
            })
         })

         it('should serialise to object (Error prototype)', function () {
            const e = Object.create(Error.prototype)
            e.code = 'ERROR_CODE'
            assert.deepStrictEqual(cleanupForJSON(e), {
               name: 'Error',
               stack: undefined,
               message: '',
               cause: undefined,
               code: e.code,
            })
         })

         it('should serialise to object (custom Error subclass)', function () {
            class CustomError extends Error {
               constructor() {
                  super('Some error')
                  this.code = 'ERROR_CODE'
                  this.properties = {
                     hello: 'world'
                  }
               }
            }
            const e = new CustomError()
            assert.deepStrictEqual(cleanupForJSON(e), {
               name: 'CustomError',
               stack: e.stack,
               message: e.message,
               cause: undefined,
               code: e.code,
               properties: e.properties,
            })
         })

         it('should serialise to object (Error from a different realm)', function () {
            const { createContext, runInContext } = require('node:vm')

            const context = createContext()

            const message = 'Some error'
            const e = runInContext(`new Error('${message}')`, context)
            assert.deepStrictEqual(cleanupForJSON(e), {
               name: 'Error',
               stack: e.stack,
               message,
               cause: undefined,
            })
         })
      })
   })

   describe('Objects', function () {

      it('should serialise to object', function () {
         const v = {
            1: '2',
            '2': 2,
            'hello': false,
            checker1() { },
            checker2: () => { },
         }
         assert.deepStrictEqual(cleanupForJSON(v), {
            1: '2',
            '2': 2,
            'hello': false,
         })
      })

      it('should keep own __proto__ key without changing prototype', function () {
         const result = cleanupForJSON(JSON.parse('{"__proto__":"x","a":1}'))

         assert.strictEqual(Object.getPrototypeOf(result), Object.prototype)
         assert.sameDeepMembers(Object.entries(result), [['__proto__', 'x'], ['a', 1]])
      })

      it('should serialise values', function () {
         const data = require('crypto').randomBytes(25)
         const date = new Date()
         const v = {
            1: /abcde\(f/ig,
            '2': data,
            'hello': date,
            'bigint': 10n,
         }
         assert.deepStrictEqual(cleanupForJSON(v), {
            1: { '@type': 'RegExp', source: 'abcde\\(f', flags: 'gi' },
            '2': { '@type': 'Buffer', length: data.length, base64: data.toString('base64') },
            'hello': date.toISOString(),
            'bigint': '10',
         })
      })

      it('should serialise object with Symbol.iterator function', function () {
         const v = {
            [Symbol.iterator]() {
               const array = ['hello', 'world']
               let nextIndex = 0
               return {
                  next: function () {
                     return nextIndex < array.length ? {
                        value: array[nextIndex++],
                        done: false
                     } : { done: true }
                  }
               }
            }
         }
         assert.deepStrictEqual(cleanupForJSON(v), ['hello', 'world'])
      })

      it('should serialise object with Symbol.iterator generator', function () {
         const v = {
            *[Symbol.iterator]() {
               yield 'hello'
               yield 'world'
            }
         }
         assert.deepStrictEqual(cleanupForJSON(v), ['hello', 'world'])
      })

      it('should serialise to object using toJSON', function () {
         const v = {
            toJSON() {
               return { hello: 'world' }
            }
         }
         assert.deepStrictEqual(cleanupForJSON(v), { hello: 'world' })
      })

      it('should serialise to object using toJSON (deep)', function () {
         const hello = {
            toJSON() {
               return 'world'
            }
         }
         const v = {
            toJSON() {
               return { hello }
            }
         }
         assert.deepStrictEqual(cleanupForJSON(v), { hello: 'world' })
      })

      it('should serialise to object passing root key toJSON', function () {
         const v = {
            toJSON() {
               return { hello: 'world' }
            }
         }
         const toJSON = sinon.spy(v, 'toJSON')

         assert.deepStrictEqual(cleanupForJSON(v), { hello: 'world' })

         sinon.assert.calledOnceWithExactly(toJSON, '')
      })

      it('should serialise to object passing parent key toJSON', function () {
         const v = {
            key: {
               toJSON() {
                  return { hello: 'world' }
               }
            }
         }
         const toJSON = sinon.spy(v.key, 'toJSON')

         assert.deepStrictEqual(cleanupForJSON(v), { key: { hello: 'world' } })

         sinon.assert.calledOnceWithExactly(toJSON, 'key')
      })

      it('should serialise to object passing parent key index toJSON', function () {
         const v = [
            {
               toJSON() {
                  return { hello: 'world' }
               }
            }
         ]
         const toJSON = sinon.spy(v[0], 'toJSON')

         assert.sameDeepOrderedMembers(cleanupForJSON(v), [{ hello: 'world' }])

         sinon.assert.calledOnceWithExactly(toJSON, '0')
      })

      it('should serialise to object passing map parent key toJSON', function () {
         const obj = {
            toJSON() {
               return { hello: 'world' }
            }
         }
         const v = new Map([[123, obj]])
         const toJSON = sinon.spy(obj, 'toJSON')

         assert.sameDeepOrderedMembers(cleanupForJSON(v), [{ key: 123, value: { hello: 'world' } }])

         sinon.assert.calledOnceWithExactly(toJSON, '123')
      })

      it('should serialise to object passing map key toJSON', function () {
         const obj = {
            toJSON() {
               return { hello: 'world' }
            }
         }
         const v = { map: new Map([[obj, 123]]) }
         const toJSON = sinon.spy(obj, 'toJSON')

         assert.deepStrictEqual(cleanupForJSON(v), { map: [{ key: { hello: 'world' }, value: 123 }] })

         sinon.assert.calledOnceWithExactly(toJSON, 'map')
      })

      it('should serialise to object using toJSON that returns array', function () {
         const v = {
            toJSON() {
               return [{ hello: 'world' }]
            }
         }
         assert.deepStrictEqual(cleanupForJSON(v), [{ hello: 'world' }])
      })

      it('should serialise to object using toJSON that returns string', function () {
         const v = {
            toJSON() {
               return 'hello'
            }
         }
         assert.deepStrictEqual(cleanupForJSON(v), 'hello')
      })

      it('should serialise to object using toJSON that returns itself', function () {
         const v = {
            toJSON() {
               return v
            }
         }
         assert.deepStrictEqual(cleanupForJSON(v), {})
         assert.notStrictEqual(cleanupForJSON(v), v)
         assert.deepStrictEqual(JSON.stringify(cleanupForJSON(v)), '{}')
      })

      it('should serialise to object using toJSON that returns this', function () {
         const v = {
            toJSON() {
               return this
            }
         }
         assert.deepStrictEqual(cleanupForJSON(v), {})
         assert.notStrictEqual(cleanupForJSON(v), v)
         assert.deepStrictEqual(JSON.stringify(cleanupForJSON(v)), '{}')
      })

      it('should serialise to object using toJSON that returns null', function () {
         const v = new Map()
         v.set('key', {
            toJSON() {
               return null
            }
         })
         assert.deepStrictEqual(cleanupForJSON(v), [{ key: 'key', value: null }])
      })

      it('should serialise to object using inspect.custom', function () {
         const v = {
            [inspect.custom]() {
               return { hello: 'world' }
            }
         }
         assert.deepStrictEqual(cleanupForJSON(v), { hello: 'world' })
      })

      it('should serialise to object using inspect.custom passing default inspect options', function () {
         const v = {
            [inspect.custom]() {
               return { hello: 'world' }
            }
         }
         const customInspect = sinon.spy(v, inspect.custom)

         assert.deepStrictEqual(cleanupForJSON(v), { hello: 'world' })

         sinon.assert.calledOnceWithExactly(customInspect, inspect.defaultOptions.depth, inspect.defaultOptions, inspect)
      })

      it('should serialise to object using inspect.custom that returns array', function () {
         const v = {
            [inspect.custom]() {
               return [{ hello: 'world' }]
            }
         }
         assert.deepStrictEqual(cleanupForJSON(v), [{ hello: 'world' }])
      })

      it('should serialise to object using inspect.custom that returns string', function () {
         const v = {
            [inspect.custom]() {
               return 'hello'
            }
         }
         assert.deepStrictEqual(cleanupForJSON(v), 'hello')
      })

      it('should serialise to object using inspect.custom that returns null', function () {
         const v = new Map()
         v.set('key', {
            [inspect.custom]() {
               return null
            }
         })
         assert.deepStrictEqual(cleanupForJSON(v), [{ key: 'key', value: null }])
      })

      context('Specific object types', function () {

         it('should serialise Headers object with unique keys', function () {
            const object = new Headers({ foo: 'bar', ahello: 'world' })
            assert.deepStrictEqual(cleanupForJSON(object), { ahello: 'world', foo: 'bar' })
         })

         it('should serialise Headers object with duplicate keys', function () {
            const object = new Headers([['foo', 'bar1'], ['ahello', 'world'], ['foo', 'bar2']])
            assert.deepStrictEqual(cleanupForJSON(object), { ahello: 'world', foo: 'bar1, bar2' })
         })

         it('should serialise Headers object with duplicate set-cookie keys', function () {
            const object = new Headers([['set-cookie', 'bar2'], ['hello', 'world'], ['set-cookie', 'bar1']])
            // Should be listed in added order
            assert.deepStrictEqual(object.getSetCookie(), ['bar2', 'bar1'])
            assert.deepStrictEqual(cleanupForJSON(object), { hello: 'world', 'set-cookie': ['bar2', 'bar1'] })
         })

         it('should serialise Headers object with single set-cookie key as array', function () {
            const object = new Headers([['set-cookie', 'bar'], ['hello', 'world']])
            assert.deepStrictEqual(cleanupForJSON(object), { hello: 'world', 'set-cookie': ['bar'] })
         })

         it('should serialise Headers object with __proto__ and constructor keys', function () {
            const object = new Headers([['__proto__', 'x'], ['constructor', 'y'], ['accept', 'z']])
            const result = cleanupForJSON(object)

            assert.strictEqual(Object.getPrototypeOf(result), Object.prototype)
            assert.sameDeepMembers(Object.entries(result), [['__proto__', 'x'], ['constructor', 'y'], ['accept', 'z']])
         })
      })
   })

   describe('redactor', function () {
      /** @type {(parentKey: string, value: string) => string} */
      const passthrough = (_parentKey, value) => value

      it('should be called with empty parent key for root string', function () {
         const redactor = sinon.spy(passthrough)

         assert.strictEqual(cleanupForJSON('hello', redactor), 'hello')

         sinon.assert.calledOnceWithExactly(redactor, '', 'hello')
      })

      it('should use the returned value', function () {
         const redactor = sinon.spy((parentKey, value) => parentKey === 'auth' ? '[REDACTED]' : value)

         assert.deepStrictEqual(cleanupForJSON({ auth: 'Bearer abc', count: 1 }, redactor), { auth: '[REDACTED]', count: 1 })

         sinon.assert.calledWithExactly(redactor, 'auth', 'Bearer abc')
      })

      it('should be called with object keys and then the converted object', function () {
         const redactor = sinon.spy(passthrough)

         cleanupForJSON({ auth: 'Bearer abc', nested: { token: 'xyz' } }, redactor)

         sinon.assert.callCount(redactor, 4)
         sinon.assert.calledWithExactly(redactor, 'auth', 'Bearer abc')
         sinon.assert.calledWithExactly(redactor, 'token', 'xyz')
         sinon.assert.calledWithExactly(redactor, 'nested', { token: 'xyz' })
         sinon.assert.calledWithExactly(redactor, '', { auth: 'Bearer abc', nested: { token: 'xyz' } })
         sinon.assert.callOrder(redactor.withArgs('token', 'xyz'), redactor.withArgs('nested', { token: 'xyz' }))
      })

      it('should be called with array indexes and then the converted array', function () {
         const redactor = sinon.spy(passthrough)

         cleanupForJSON({ list: ['a', 'b'] }, redactor)

         sinon.assert.callCount(redactor, 4)
         sinon.assert.calledWithExactly(redactor, '0', 'a')
         sinon.assert.calledWithExactly(redactor, '1', 'b')
         sinon.assert.calledWithExactly(redactor, 'list', ['a', 'b'])
         sinon.assert.calledWithExactly(redactor, '', { list: ['a', 'b'] })
      })

      it('should be called once with Set indexes and then the converted Set', function () {
         const redactor = sinon.spy(passthrough)

         cleanupForJSON({ set: new Set(['a', 'b']) }, redactor)

         sinon.assert.callCount(redactor, 4)
         sinon.assert.calledWithExactly(redactor, '0', 'a')
         sinon.assert.calledWithExactly(redactor, '1', 'b')
         sinon.assert.calledOnceWithExactly(redactor.withArgs('set'), 'set', ['a', 'b'])
         sinon.assert.calledWithExactly(redactor, '', { set: ['a', 'b'] })
      })

      it('should be called once for iterables', function () {
         const redactor = sinon.spy(passthrough)

         cleanupForJSON({ iter: { *[Symbol.iterator]() { yield 'a' } } }, redactor)

         sinon.assert.callCount(redactor, 3)
         sinon.assert.calledWithExactly(redactor, '0', 'a')
         sinon.assert.calledOnceWithExactly(redactor.withArgs('iter'), 'iter', ['a'])
         sinon.assert.calledWithExactly(redactor, '', { iter: ['a'] })
      })

      it('should be called with Map parent key for keys and Map key for values', function () {
         const redactor = sinon.spy(passthrough)

         cleanupForJSON({ headers: new Map([['authorization', 'Bearer abc'], [123, 'num']]) }, redactor)

         const converted = [{ key: 'authorization', value: 'Bearer abc' }, { key: 123, value: 'num' }]
         sinon.assert.callCount(redactor, 6)
         sinon.assert.calledWithExactly(redactor, 'headers', 'authorization')
         sinon.assert.calledWithExactly(redactor, 'authorization', 'Bearer abc')
         sinon.assert.calledWithExactly(redactor, 'headers', 123)
         sinon.assert.calledWithExactly(redactor, '123', 'num')
         sinon.assert.calledWithExactly(redactor, 'headers', converted)
         sinon.assert.calledWithExactly(redactor, '', { headers: converted })
      })

      it('should be called with header names for Headers values', function () {
         const redactor = sinon.spy(passthrough)

         cleanupForJSON({ headers: new Headers([['cookie', 'sid=abc'], ['set-cookie', 'a=1']]) }, redactor)

         sinon.assert.calledWithExactly(redactor, 'cookie', 'sid=abc')
         sinon.assert.calledWithExactly(redactor, 'set-cookie', ['a=1'])
         sinon.assert.calledOnceWithExactly(redactor.withArgs('headers'), 'headers', { cookie: 'sid=abc', 'set-cookie': ['a=1'] })
      })

      it('should be called once with Error properties and then the converted Error', function () {
         const redactor = sinon.spy(passthrough)
         const e = new Error('Some secret')
         e.code = 'ERROR_CODE'

         cleanupForJSON({ error: e }, redactor)

         const converted = { code: 'ERROR_CODE', name: 'Error', stack: e.stack, message: 'Some secret', cause: undefined }
         sinon.assert.callCount(redactor, 7)
         sinon.assert.calledWithExactly(redactor, 'code', 'ERROR_CODE')
         sinon.assert.calledWithExactly(redactor, 'name', 'Error')
         sinon.assert.calledWithExactly(redactor, 'stack', e.stack)
         sinon.assert.calledWithExactly(redactor, 'message', 'Some secret')
         sinon.assert.calledWithExactly(redactor, 'cause', undefined)
         sinon.assert.calledOnceWithExactly(redactor.withArgs('error'), 'error', converted)
         sinon.assert.calledWithExactly(redactor, '', { error: converted })
      })

      it('should be called with parent key for toJSON string', function () {
         const redactor = sinon.spy(passthrough)

         cleanupForJSON({ value: { toJSON: () => 'hello' } }, redactor)

         sinon.assert.callCount(redactor, 2)
         sinon.assert.calledWithExactly(redactor, 'value', 'hello')
         sinon.assert.calledWithExactly(redactor, '', { value: 'hello' })
      })

      it('should be called with parent key for inspect.custom string', function () {
         const redactor = sinon.spy(passthrough)

         cleanupForJSON({ value: { [inspect.custom]: () => 'hello' } }, redactor)

         sinon.assert.callCount(redactor, 2)
         sinon.assert.calledWithExactly(redactor, 'value', 'hello')
         sinon.assert.calledWithExactly(redactor, '', { value: 'hello' })
      })

      it('should be called for non-string primitives', function () {
         const redactor = sinon.spy(passthrough)

         cleanupForJSON({ number: 1, boolean: true, null: null, undefined: undefined, bigint: 10n }, redactor)

         sinon.assert.calledWithExactly(redactor, 'number', 1)
         sinon.assert.calledWithExactly(redactor, 'boolean', true)
         sinon.assert.calledWithExactly(redactor, 'null', null)
         sinon.assert.calledWithExactly(redactor, 'undefined', undefined)
         sinon.assert.calledWithExactly(redactor, 'bigint', '10')
      })

      it('should be called with Buffer base64 and RegExp source', function () {
         const redactor = sinon.spy(passthrough)

         cleanupForJSON({ buffer: Buffer.from('hello'), regexp: /abc/g }, redactor)

         sinon.assert.calledWithExactly(redactor, 'buffer', Buffer.from('hello').toString('base64'))
         sinon.assert.calledWithExactly(redactor, 'regexp', 'abc')
      })

      it('should use the returned value for Buffer base64 and RegExp source', function () {
         const redactor = sinon.spy((parentKey, value) => parentKey ? '[REDACTED]' : value)

         assert.deepStrictEqual(cleanupForJSON({ buffer: Buffer.from('hello'), regexp: /abc/g }, redactor), {
            buffer: { '@type': 'Buffer', length: 5, base64: '[REDACTED]' },
            regexp: { '@type': 'RegExp', source: '[REDACTED]', flags: 'g' },
         })
      })

      it('should not be called for Dates or circular references', function () {
         const redactor = sinon.spy(passthrough)
         const v = { date: new Date(0) }
         v.circular = v

         cleanupForJSON(v, redactor)

         sinon.assert.calledOnceWithExactly(redactor, '', { date: '1970-01-01T00:00:00.000Z', circular: '[Circular]' })
      })
   })
})
