// @ts-check
const { assert } = require('chai')
const hrTime = require('../src/hr-time')

describe('hr-time', function () {

   context('.now', function () {

      it('should return calculated value', function () {
         const now = 1n
         const boot = 2n
         assert.strictEqual(hrTime.now(now, boot), 3n)
      })

      it('should return a value', function () {
         assert.ok(hrTime.now() > process.hrtime.bigint())
      })
   })

   context('.hrToTimestamp', function () {

      it('should convert timestamp without nanoseconds component', function () {
         assert.deepStrictEqual(hrTime.hrToTimestamp(1000000000n), { seconds: 1, nanos: 0 })
         assert.deepStrictEqual(hrTime.hrToTimestamp(10000000000n), { seconds: 10, nanos: 0 })
         assert.deepStrictEqual(hrTime.hrToTimestamp(120000000000n), { seconds: 120, nanos: 0 })
      })

      it('should convert timestamp with nanoseconds component', function () {
         assert.deepStrictEqual(hrTime.hrToTimestamp(1n), { seconds: 0, nanos: 1 })
         assert.deepStrictEqual(hrTime.hrToTimestamp(999999999n), { seconds: 0, nanos: 999999999 })
         assert.deepStrictEqual(hrTime.hrToTimestamp(10000000001n), { seconds: 10, nanos: 1 })
         assert.deepStrictEqual(hrTime.hrToTimestamp(120000100000n), { seconds: 120, nanos: 100000 })
         assert.deepStrictEqual(hrTime.hrToTimestamp(1733142191843193754n), { seconds: 1733142191, nanos: 843193754 })
      })
   })

   context('.timestampToISOString', function () {

      context('full precision', function () {

         it('should convert timestamp without nanoseconds component', function () {
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 1, nanos: 0 }), '1970-01-01T00:00:01.000000000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 10, nanos: 0 }), '1970-01-01T00:00:10.000000000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 120, nanos: 0 }), '1970-01-01T00:02:00.000000000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 1733142191, nanos: 0 }), '2024-12-02T12:23:11.000000000Z')
         })

         it('should convert timestamp with nanoseconds component', function () {
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 0, nanos: 1 }), '1970-01-01T00:00:00.000000001Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 0, nanos: 1000 }), '1970-01-01T00:00:00.000001000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 0, nanos: 1000000 }), '1970-01-01T00:00:00.001000000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 0, nanos: 999999999 }), '1970-01-01T00:00:00.999999999Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 1, nanos: 999999999 }), '1970-01-01T00:00:01.999999999Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 10, nanos: 999999999 }), '1970-01-01T00:00:10.999999999Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 120, nanos: 999999999 }), '1970-01-01T00:02:00.999999999Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 1733142191, nanos: 843000000 }), '2024-12-02T12:23:11.843000000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 1733142191, nanos: 843193754 }), '2024-12-02T12:23:11.843193754Z')
         })
      })

      context('provided precision', function () {

         it('should convert timestamp without nanoseconds component', function () {
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 1, nanos: 0 }, 3), '1970-01-01T00:00:01.000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 10, nanos: 0 }, 3), '1970-01-01T00:00:10.000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 120, nanos: 0 }, 3), '1970-01-01T00:02:00.000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 1733142191, nanos: 0 }, 3), '2024-12-02T12:23:11.000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 1, nanos: 0 }, 6), '1970-01-01T00:00:01.000000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 10, nanos: 0 }, 6), '1970-01-01T00:00:10.000000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 120, nanos: 0 }, 6), '1970-01-01T00:02:00.000000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 1733142191, nanos: 0 }, 6), '2024-12-02T12:23:11.000000Z')
         })

         it('should convert timestamp with nanoseconds component', function () {
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 0, nanos: 1 }, 3), '1970-01-01T00:00:00.000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 0, nanos: 1000 }, 3), '1970-01-01T00:00:00.000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 0, nanos: 1000000 }, 3), '1970-01-01T00:00:00.001Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 0, nanos: 999999999 }, 3), '1970-01-01T00:00:01.000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 1, nanos: 999999999 }, 3), '1970-01-01T00:00:02.000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 10, nanos: 999999999 }, 3), '1970-01-01T00:00:11.000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 120, nanos: 999999999 }, 3), '1970-01-01T00:02:01.000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 1733142191, nanos: 843000000 }, 3), '2024-12-02T12:23:11.843Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 1733142191, nanos: 843193754 }, 3), '2024-12-02T12:23:11.843Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 0, nanos: 1 }, 6), '1970-01-01T00:00:00.000000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 0, nanos: 1000 }, 6), '1970-01-01T00:00:00.000001Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 0, nanos: 1000000 }, 6), '1970-01-01T00:00:00.001000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 0, nanos: 999999999 }, 6), '1970-01-01T00:00:01.000000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 1, nanos: 999999999 }, 6), '1970-01-01T00:00:02.000000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 10, nanos: 999999999 }, 6), '1970-01-01T00:00:11.000000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 120, nanos: 999999999 }, 6), '1970-01-01T00:02:01.000000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 1733142191, nanos: 843000000 }, 6), '2024-12-02T12:23:11.843000Z')
            assert.strictEqual(hrTime.timestampToISOString({ seconds: 1733142191, nanos: 843193754 }, 6), '2024-12-02T12:23:11.843194Z')
         })
      })
   })
})
