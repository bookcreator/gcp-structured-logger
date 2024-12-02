const START = process.hrtime.bigint()
const BOOT = Date.now()
const END = process.hrtime.bigint()

const NS_MICROSECOND = 1000n
const NS_MILLISECOND = 1000n * NS_MICROSECOND
const NS_SECOND = 1000n * NS_MILLISECOND
const NS_MINUTE = 60n * NS_SECOND
const NS_HOUR = 60n * NS_MINUTE

// Use middle of the START/END to get NS to for BOOT
const BOOT_HR = START + ((END - START) / 2n)
const BOOT_NS = (BigInt(BOOT) * NS_MILLISECOND) - BOOT_HR

function nowHR(hr = process.hrtime.bigint(), bootHr = BOOT_NS) {
   return bootHr + hr
}

/**
 * @typedef {{ seconds: number, nanos: number }} Timestamp
 * @param {bigint} hr
 * @returns {Timestamp}
 * @see https://cloud.google.com/logging/docs/agent/configuration#timestamp-processing
 */
function hrToTimestamp(hr) {
   const seconds = Math.floor(Number(hr / NS_SECOND))
   const nanos = Number(hr - (BigInt(seconds) * NS_SECOND))
   return { seconds, nanos }
}

/**
 * @param {Timestamp} ts
 * @param {number} precision
 * @returns {string}
 */
function timestampToISOString(ts, precision = 9) {
   const sec = ts.seconds % 60
   const [s, ns] = (sec + (ts.nanos / Number(NS_SECOND))).toFixed(precision).split('.')
   const date = new Date(ts.seconds * 1e3)
   const datePart = `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toFixed(0).padStart(2, '0')}-${date.getUTCDate().toFixed(0).padStart(2, '0')}`
   const timePart = `${date.getUTCHours().toFixed(0).padStart(2, '0')}:${date.getUTCMinutes().toFixed(0).padStart(2, '0')}:${s.padStart(2, '0')}.${ns}`
   return `${datePart}T${timePart}Z`
}

module.exports = {
   BOOT_NS,
   now: nowHR,
   hrToTimestamp,
   timestampToISOString,
   NS_MICROSECOND,
   NS_MILLISECOND,
   NS_SECOND,
   NS_MINUTE,
   NS_HOUR,
}
