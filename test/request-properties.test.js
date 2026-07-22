const { constants: http2 } = require('node:http2')

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

         it('should ignore excessively large x-forwarded-for headers', function () {
            const req = make({
               ...base,
               headers: {
                  'x-forwarded-for': '127.0.0.1,'.repeat(200) + '10.0.0.0'
               }
            })
            assert.strictEqual(getRemoteIp(req))
         })
      })
   })

   context('Http2RequestHeaders', function () {
      const httpVersion = '1.0'
      const base = {
         path: '/url.com',
         method: 'GET',
         authority: 'url.com',
         scheme: 'https',
      }

      /**
       * @param {Partial<{ path: string, method: string, authority: string, scheme: string }>} req
       * @param {import('../src/http2-request-headers').Http2RequestHeaders} headers
       */
      const make = ({ path, method, authority, scheme } = {}, headers = {}) => new (require('../src/http2-request-headers').Http2RequestHeaders)({
         ...headers,
         ...base,
         [http2.HTTP2_HEADER_PATH]: path,
         [http2.HTTP2_HEADER_METHOD]: method,
         [http2.HTTP2_HEADER_AUTHORITY]: authority,
         [http2.HTTP2_HEADER_SCHEME]: scheme,
      })

      context('.getUrl', function () {

         it('should return url', function () {
            const url = 'https://url.com/rewritten'
            const req = make({
               ...base,
               path: url,
            })
            assert.strictEqual(getUrl(req), url)
         })
      })

      context('.getHeader', function () {

         it('should return header', function () {
            const req = make({}, {
               [http2.HTTP2_HEADER_USER_AGENT]: 'UA',
            })
            assert.strictEqual(getHeader(req, 'user-agent'), 'UA')
         })

         it('should return no header for missing value', function () {
            const req = make()
            assert.isUndefined(getHeader(req, 'user-agent'))
         })
      })

      context('.getProtocol', function () {

         it('should return protocol', function () {
            const req = make()
            assert.strictEqual(getProtocol(req), 'h2')
         })
      })

      context('.getResponse', function () {

         it('should return no response', function () {
            const req = make()
            assert.isUndefined(getResponse(req))
         })
      })

      context('.getRemoteIp', function () {

         it('should return value derived from x-forwarded-for header', function () {
            const req = make({}, {
               'x-forwarded-for': '127.0.0.1'
            })
            assert.strictEqual(getRemoteIp(req), '127.0.0.1')
         })

         it('should return value derived from x-forwarded-for headers (multiple values)', function () {
            const req = make({}, {
               'x-forwarded-for': '127.0.0.1, 10.0.0.0'
            })
            assert.strictEqual(getRemoteIp(req), '127.0.0.1')
         })

         it('should not return value derived from x-forwarded-for headers', function () {
            const req = make({}, {
               'x-forwarded-for': ''
            })
            assert.isUndefined(getRemoteIp(req))
         })

         it('should return nothing when no x-forwarded-for header is present', function () {
            const req = make()
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

   context('raw request', function () {
      // A structural request exposing plain-object `headers` (already
      // lower-cased keys) with no Express-style `get` accessor and no WHATWG
      // `Headers`, plus the degenerate case where `headers` is absent entirely
      // (the `Request` typedef makes it optional).
      const base = {
         url,
         method,
      }

      context('.getHeader', function () {

         it('should return header from plain-object headers', function () {
            const req = {
               ...base,
               headers: {
                  'user-agent': 'UA'
               }
            }
            assert.strictEqual(getHeader(req, 'User-Agent'), 'UA')
         })

         it('should join array-valued headers', function () {
            const req = {
               ...base,
               headers: {
                  'x-forwarded-for': ['127.0.0.1', '10.0.0.0']
               }
            }
            assert.strictEqual(getHeader(req, 'x-forwarded-for'), '127.0.0.1, 10.0.0.0')
         })

         it('should return no header for missing value', function () {
            const req = {
               ...base,
               headers: {}
            }
            assert.isUndefined(getHeader(req, 'user-agent'))
         })

         it('should return no header when headers are absent', function () {
            const req = { ...base }
            assert.isUndefined(getHeader(req, 'user-agent'))
         })
      })
   })
})
