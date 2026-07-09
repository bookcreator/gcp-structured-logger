const { assert } = require('chai')
const { createSandbox } = require('sinon')

const sinon = createSandbox()

describe('next.js', function () {

   /** @type {import('../next')} */
   let next
   /** @type {InstanceType<import('..')['Logging']>} */
   let logging

   /** @param {{ headers?: { [k: string]: string } }} obj */
   const make = ({ headers } = { headers: {} }) => ({
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
                  if (typeof name === 'string' && name.toLowerCase() === n.toLowerCase()) return headers[n]
               }
            }
         }
      }
   })

   before(function () {
      next = require('../next')
   })

   beforeEach(function () {
      logging = new (require('..').Logging)({ projectId: 'project-id', logName: 'log-name', serviceContext: { service: 'test' } })
   })

   after(function () {
      sinon.restore()
   })

   describe('#nextJSMiddleware', function () {

      it('should return void', function () {
         assert.isUndefined(next.nextJSMiddleware(logging, make()))
      })

      it('should attach a StructuredRequestLogger as req.log', function () {
         const req = make()
         next.nextJSMiddleware(logging, req)
         assert.instanceOf(req.log, require('../src/StructuredLogger').StructuredRequestLogger)
      })
   })
})
