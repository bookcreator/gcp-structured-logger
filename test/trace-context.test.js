const { assert } = require('chai')
const traceContext = require('../src/trace-context')

describe('trace-context', function () {

   const PROJECT_ID = 'project-id'
   const makeReq = headerVal => ({
      get(key) {
         if (typeof key === 'string' && key.toLowerCase() === 'x-cloud-trace-context') {
            return headerVal
         }
         return key
      }
   })

   it('should ignore requests with trace header', function () {
      assert.deepStrictEqual(traceContext(PROJECT_ID, makeReq()), {})
   })
   it('should ignore requests with invalid trace header', function () {
      assert.deepStrictEqual(traceContext(PROJECT_ID, makeReq('blah')), {})
   })
   it('should extract context for requests with trace header', function () {
      const traceId = '59973d340da5c40f77349df948ef7531'
      const spanId = 15
      assert.deepStrictEqual(traceContext(PROJECT_ID, makeReq(`${traceId}/${spanId}`)), {
         spanId: '000000000000000f',
         trace: `projects/${PROJECT_ID}/traces/${traceId}`,
      })
   })
   it('should extract context for requests with trace header (with options)', function () {
      const traceId = '703ea69e0cf1952e228fe792159d5996'
      const spanId = 9007199254740991
      assert.deepStrictEqual(traceContext(PROJECT_ID, makeReq(`${traceId}/${spanId};o=0`)), {
         spanId: '001fffffffffffff',
         trace: `projects/${PROJECT_ID}/traces/${traceId}`,
      })
   })
   it('should extract context for requests with trace header (64-bit span)', function () {
      const traceId = 'fb48e517f910e54d5b6f55e16c65fe3a'
      const spanId = '9007199254740992'
      assert.deepStrictEqual(traceContext(PROJECT_ID, makeReq(`${traceId}/${spanId}`)), {
         spanId: '0020000000000000',
         trace: `projects/${PROJECT_ID}/traces/${traceId}`,
      })
   })
   it('should extract context for requests with trace header (64-bit span with options)', function () {
      const traceId = '0eac9cb48de916b2c5d5fb0eafcbc712'
      const spanId = '17710341711684079263'
      assert.deepStrictEqual(traceContext(PROJECT_ID, makeReq(`${traceId}/${spanId};o=1`)), {
         spanId: 'f5c7c5f40fb68e9f',
         trace: `projects/${PROJECT_ID}/traces/${traceId}`,
      })
   })
})
