const { constants: http2 } = require('node:http2')
const { assert } = require('chai')

const { Http2RequestHeaders } = require('../src/http2-request-headers')

describe('http2-request-headers', function () {

   /**
    * @param {import('node:http2').IncomingHttpHeaders} [headers]
    */
   const make = (headers = {}) => new Http2RequestHeaders(headers)

   context('.http2Protocol', function () {

      it('should return h2', function () {
         assert.strictEqual(make().http2Protocol, 'h2')
      })
   })

   context('.url', function () {

      it('should return path header', function () {
         const req = make({ [http2.HTTP2_HEADER_PATH]: '/some/path' })
         assert.strictEqual(req.url, '/some/path')
      })

      it('should return no value for missing path header', function () {
         assert.isUndefined(make().url)
      })
   })

   context('.scheme', function () {

      it('should return scheme header', function () {
         const req = make({ [http2.HTTP2_HEADER_SCHEME]: 'https' })
         assert.strictEqual(req.scheme, 'https')
      })

      it('should return no value for missing scheme header', function () {
         assert.isUndefined(make().scheme)
      })
   })

   context('.method', function () {

      it('should return method header', function () {
         const req = make({ [http2.HTTP2_HEADER_METHOD]: 'GET' })
         assert.strictEqual(req.method, 'GET')
      })

      it('should return no value for missing method header', function () {
         assert.isUndefined(make().method)
      })
   })

   context('.get', function () {

      it('should return header value', function () {
         const req = make({ [http2.HTTP2_HEADER_USER_AGENT]: 'UA' })
         assert.strictEqual(req.get('user-agent'), 'UA')
      })

      it('should return header value for differently cased name', function () {
         const req = make({ [http2.HTTP2_HEADER_USER_AGENT]: 'UA' })
         assert.strictEqual(req.get(/** @type {any} */('User-Agent')), 'UA')
      })

      it('should return array value for set-cookie header', function () {
         const req = make({ [http2.HTTP2_HEADER_SET_COOKIE]: ['a=1', 'b=2'] })
         assert.deepStrictEqual(req.get('set-cookie'), ['a=1', 'b=2'])
      })

      it('should return no value for missing header', function () {
         assert.isUndefined(make().get('user-agent'))
      })

      it('should return no value for unknown header name', function () {
         const req = make({ [/** @type {any} */('x-not-a-header')]: 'value' })
         assert.isUndefined(req.get(/** @type {any} */('x-not-a-header')))
      })
   })
})
