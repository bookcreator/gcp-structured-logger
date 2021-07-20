const { inspect } = require('util')
const { assert } = require('chai')
const sinon = require('sinon')

const cleanupForJSON = require('../src/cleanup-for-json')

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
         })
      })
      it('should serialise to object (Error subclass)', function () {
         const e = new TypeError('Some error')
         assert.deepStrictEqual(cleanupForJSON(e), {
            name: 'TypeError',
            stack: e.stack,
            message: e.message,
         })
      })
      it('should serialise to object (Error prototype)', function () {
         const e = Object.create(Error.prototype)
         assert.deepStrictEqual(cleanupForJSON(e), {
            name: 'Error',
            stack: undefined,
            message: '',
         })
      })
      it('should serialise to object (custom Error subclass)', function () {
         class CustomError extends Error { }
         const e = new CustomError('Some error')
         assert.deepStrictEqual(cleanupForJSON(e), {
            name: 'CustomError',
            stack: e.stack,
            message: e.message,
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
            },
            array: [
               {
                  name: 'Error',
                  stack: err2.stack,
                  message: err2.message,
                  code: err2.code,
               },
               {
                  name: 'TypeError',
                  stack: err3.stack,
                  message: err3.message,
               }
            ]
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
               code: e.code,
               properties: e.properties,
            })
         })
      })
   })

   describe('Objects', function () {
      it('should serialise to object', function () {
         const v = {
            1: '2',
            '2': 2,
            'hello': false
         }
         assert.deepStrictEqual(cleanupForJSON(v), v)
      })
      it('should serialise values', function () {
         const data = require('crypto').randomBytes(25)
         const date = new Date()
         const v = {
            1: /abcde\(f/ig,
            '2': data,
            'hello': date
         }
         assert.deepStrictEqual(cleanupForJSON(v), {
            1: { '@type': 'RegExp', source: 'abcde\\(f', flags: 'gi' },
            '2': { '@type': 'Buffer', length: data.length, base64: data.toString('base64') },
            'hello': date.toISOString(),
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

         sinon.assert.calledOnceWithExactly(customInspect, inspect.defaultOptions.depth, inspect.defaultOptions)
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
   })
})
