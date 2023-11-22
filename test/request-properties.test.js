const { assert } = require('chai')
const { getUrl, getHeader, getProtocol, getRemoteIp, getResponse } = require('../src/request-properties')

describe('request-transformers', function () {

   const url = 'https://url.com'
   const method = 'GET'

   context('express.Request', function () {
      const httpVersion = '1.0'
      const base = {
         originalUrl: url,
         method,
         httpVersion,
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

      context('.getUrl', function () {

         it('should return url', function () {
            const req = make({
               ...base,
               url: url + '/rewritten'
            })
            assert.strictEqual(getUrl(req), url)
         })
      })

      context('.getHeader', function () {

         it('should return header', function () {
            const req = make({
               ...base,
               headers: {
                  'user-agent': 'UA'
               }
            })
            assert.strictEqual(getHeader(req, 'user-agent'), 'UA')
         })

         it('should return no header for missing value', function () {
            const req = make({
               ...base,
               headers: {
               }
            })
            assert.isUndefined(getHeader(req, 'user-agent'))
         })
      })

      context('.getProtocol', function () {

         it('should return no protocol', function () {
            const req = make({
               ...base,
            })
            assert.isUndefined(getProtocol(req))
         })

         it('should return protocol with HTTP version', function () {
            const req = make({
               ...base,
               protocol: 'https'
            })
            assert.strictEqual(getProtocol(req), 'https/' + httpVersion)
         })
      })

      context('.getResponse', function () {

         it('should return no response', function () {
            const req = make({
               ...base,
            })
            assert.isUndefined(getResponse(req))
         })

         it('should return set response object', function () {
            const res = {}
            const req = make({
               ...base,
               res,
            })
            assert.strictEqual(getResponse(req), res)
         })
      })

      context('.getRemoteIp', function () {

         it('should return value derived from req.ip', function () {
            const req = make({
               ...base,
               ip: '127.0.0.1'
            })
            assert.strictEqual(getRemoteIp(req), '127.0.0.1')
         })
         it('should return value derived from req.ips', function () {
            const req = make({
               ...base,
               ips: ['127.0.0.1']
            })
            assert.strictEqual(getRemoteIp(req), '127.0.0.1')
         })
         it('should return value derived from x-forwarded-for header', function () {
            const req = make({
               ...base,
               headers: {
                  'x-forwarded-for': '127.0.0.1'
               }
            })
            assert.strictEqual(getRemoteIp(req), '127.0.0.1')
         })
         it('should return value derived from x-forwarded-for headers', function () {
            const req = make({
               ...base,
               headers: {
                  'x-forwarded-for': '127.0.0.1'
               }
            })
            assert.strictEqual(getRemoteIp(req), '127.0.0.1')
         })
         it('should return value derived from x-forwarded-for headers (multiple values)', function () {
            const req = make({
               ...base,
               headers: {
                  'x-forwarded-for': '127.0.0.1, 10.0.0.0'
               }
            })
            assert.strictEqual(getRemoteIp(req), '127.0.0.1')
         })
         it('should not return value derived from x-forwarded-for headers', function () {
            const req = make({
               ...base,
               headers: {
                  'x-forwarded-for': ''
               }
            })
            assert.isUndefined(getRemoteIp(req))
         })
      })
   })

   context('next.NextRequest', function () {
      const base = {
         url,
         method,
      }

      /** @param {Partial<import('next/server').NextRequest>} obj */
      const make = ({ headers, ...obj } = { headers: {} }) => ({
         ...obj,
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

      context('.getUrl', function () {

         it('should return url', function () {
            const req = make({
               ...base,
            })
            assert.strictEqual(getUrl(req), url)
         })
      })

      context('.getHeader', function () {

         it('should return header', function () {
            const req = make({
               ...base,
               headers: {
                  'user-agent': 'UA'
               }
            })
            assert.strictEqual(getHeader(req, 'user-agent'), 'UA')
         })

         it('should return no header for missing value', function () {
            const req = make({
               ...base,
               headers: {
               }
            })
            assert.isUndefined(getHeader(req, 'user-agent'))
         })
      })

      context('.getProtocol', function () {

         it('should return no protocol', function () {
            const req = make({
               ...base,
            })
            assert.isUndefined(getProtocol(req))
         })
      })

      context('.getResponse', function () {

         it('should return no response', function () {
            const req = make({
               ...base,
            })
            assert.isUndefined(getResponse(req))
         })
      })

      context('.getRemoteIp', function () {

         it('should not return value derived from req.ip', function () {
            const req = make({
               ...base,
               ip: '127.0.0.1'
            })
            assert.isUndefined(getRemoteIp(req))
         })
         it('should return value derived from x-forwarded-for header', function () {
            const req = make({
               ...base,
               headers: {
                  'x-forwarded-for': '127.0.0.1'
               }
            })
            assert.strictEqual(getRemoteIp(req), '127.0.0.1')
         })
         it('should return value derived from x-forwarded-for headers', function () {
            const req = make({
               ...base,
               headers: {
                  'x-forwarded-for': '127.0.0.1'
               }
            })
            assert.strictEqual(getRemoteIp(req), '127.0.0.1')
         })
         it('should return value derived from x-forwarded-for headers (multiple values)', function () {
            const req = make({
               ...base,
               headers: {
                  'x-forwarded-for': '127.0.0.1, 10.0.0.0'
               }
            })
            assert.strictEqual(getRemoteIp(req), '127.0.0.1')
         })
         it('should not return value derived from x-forwarded-for headers', function () {
            const req = make({
               ...base,
               headers: {
                  'x-forwarded-for': ''
               }
            })
            assert.isUndefined(getRemoteIp(req))
         })
      })
   })
})
