const { assert } = require('chai')
const { extractTraceContext } = require('../src/trace-context')

describe('trace-context', function () {

   const PROJECT_ID = 'project-id'

   context('traceparent header', function () {
      const makeReq = headerVal => ({
         get(key) {
            if (typeof key === 'string' && key.toLowerCase() === 'traceparent') {
               return headerVal
            }
            return key
         }
      })

      it('should ignore requests without trace header', function () {
         assert.deepStrictEqual(extractTraceContext(PROJECT_ID, makeReq()), {})
      })

      it('should ignore requests with invalid trace header', function () {
         assert.deepStrictEqual(extractTraceContext(PROJECT_ID, makeReq('blah')), {})
      })

      it('should ignore requests with invalid trace header - null trace ID', function () {
         assert.deepStrictEqual(extractTraceContext(PROJECT_ID, makeReq('00-00000000000000000000000000000000-0000000000000001-00')), {})
      })

      it('should ignore requests with invalid trace header - null span ID', function () {
         assert.deepStrictEqual(extractTraceContext(PROJECT_ID, makeReq('00-00000000000000000000000000000001-0000000000000000-00')), {})
      })

      it('should extract context for requests with trace header', function () {
         assert.deepStrictEqual(extractTraceContext(PROJECT_ID, makeReq('00-fbd010918cebe1dbb9990adba0667057-000000000000000f-01')), {
            spanId: '000000000000000f',
            trace: `projects/${PROJECT_ID}/traces/fbd010918cebe1dbb9990adba0667057`,
            traceSampled: true,
         })
      })

      it('should extract context for requests with trace header (with options)', function () {
         assert.deepStrictEqual(extractTraceContext(PROJECT_ID, makeReq('00-703ea69e0cf1952e228fe792159d5996-001fffffffffffff-00')), {
            spanId: '001fffffffffffff',
            trace: `projects/${PROJECT_ID}/traces/703ea69e0cf1952e228fe792159d5996`,
            traceSampled: false,
         })
      })

      it('should extract context for requests with trace header (64-bit span)', function () {
         assert.deepStrictEqual(extractTraceContext(PROJECT_ID, makeReq('00-fb48e517f910e54d5b6f55e16c65fe3a-9007199254740992-01')), {
            spanId: '9007199254740992',
            trace: `projects/${PROJECT_ID}/traces/fb48e517f910e54d5b6f55e16c65fe3a`,
            traceSampled: true,
         })
      })

      it('should extract context for requests with trace header (64-bit span with options)', function () {
         assert.deepStrictEqual(extractTraceContext(PROJECT_ID, makeReq('00-0eac9cb48de916b2c5d5fb0eafcbc712-f5c7c5f40fb68e9f-00')), {
            spanId: 'f5c7c5f40fb68e9f',
            trace: `projects/${PROJECT_ID}/traces/0eac9cb48de916b2c5d5fb0eafcbc712`,
            traceSampled: false,
         })
      })
   })

   context('Legacy x-cloud-trace-context header', function () {
      const makeReq = headerVal => ({
         get(key) {
            if (typeof key === 'string' && key.toLowerCase() === 'x-cloud-trace-context') {
               return headerVal
            }
            return key
         }
      })

      it('should ignore requests without trace header', function () {
         assert.deepStrictEqual(extractTraceContext(PROJECT_ID, makeReq()), {})
      })

      it('should ignore requests with invalid trace header', function () {
         assert.deepStrictEqual(extractTraceContext(PROJECT_ID, makeReq('blah')), {})
      })

      it('should ignore requests with invalid trace header - null trace ID', function () {
         assert.deepStrictEqual(extractTraceContext(PROJECT_ID, makeReq('00000000000000000000000000000000/1;o=1')), {})
      })

      it('should ignore requests with invalid trace header - null span ID', function () {
         assert.deepStrictEqual(extractTraceContext(PROJECT_ID, makeReq('00000000000000000000000000000001/0')), {})
      })

      it('should extract context for requests with trace header', function () {
         const traceId = '59973d340da5c40f77349df948ef7531'
         const spanId = 15
         assert.deepStrictEqual(extractTraceContext(PROJECT_ID, makeReq(`${traceId}/${spanId}`)), {
            spanId: '000000000000000f',
            trace: `projects/${PROJECT_ID}/traces/${traceId}`,
            traceSampled: true,
         })
      })

      it('should extract context for requests with trace header (with options)', function () {
         const traceId = '703ea69e0cf1952e228fe792159d5996'
         const spanId = 9007199254740991
         assert.deepStrictEqual(extractTraceContext(PROJECT_ID, makeReq(`${traceId}/${spanId};o=0`)), {
            spanId: '001fffffffffffff',
            trace: `projects/${PROJECT_ID}/traces/${traceId}`,
            traceSampled: false,
         })
      })

      it('should extract context for requests with trace header (64-bit span)', function () {
         const traceId = 'fb48e517f910e54d5b6f55e16c65fe3a'
         const spanId = '9007199254740992'
         assert.deepStrictEqual(extractTraceContext(PROJECT_ID, makeReq(`${traceId}/${spanId}`)), {
            spanId: '0020000000000000',
            trace: `projects/${PROJECT_ID}/traces/${traceId}`,
            traceSampled: true,
         })
      })

      it('should extract context for requests with trace header (64-bit span with options)', function () {
         const traceId = '0eac9cb48de916b2c5d5fb0eafcbc712'
         const spanId = '17710341711684079263'
         assert.deepStrictEqual(extractTraceContext(PROJECT_ID, makeReq(`${traceId}/${spanId};o=1`)), {
            spanId: 'f5c7c5f40fb68e9f',
            trace: `projects/${PROJECT_ID}/traces/${traceId}`,
            traceSampled: true,
         })
      })
   })
})
