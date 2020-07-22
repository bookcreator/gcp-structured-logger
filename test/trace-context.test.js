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
      assert.isNull(traceContext(PROJECT_ID, makeReq()))
   })
   it('should ignore requests with invalid trace header', function () {
      assert.isNull(traceContext(PROJECT_ID, makeReq('blah')))
   })
   it('should augment context for requests with trace header', function () {
      const traceId = '59973d340da5c40f77349df948ef7531'
      const spanId = 288377245651
      assert.deepStrictEqual(traceContext(PROJECT_ID, makeReq(`${traceId}/${spanId}`)), {
         traceId,
         spanId: spanId.toString(16).padStart(16, '0'),
         options: undefined,
         trace: `projects/${PROJECT_ID}/traces/${traceId}`,
      })
   })
})
