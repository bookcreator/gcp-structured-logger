const { getHeader } = require('./request-properties')

const TRACEPARENT_HEADER_NAME = 'traceparent'
/** @see https://www.w3.org/TR/trace-context/#traceparent-header-field-values */
const TRACEPARENT_HEADER_FORMAT_V0 = /^00-(?<traceId>[a-f0-9]{32})-(?<spanId>[a-f0-9]{16})-(?<flags>[a-f0-9]{2})$/i

const CLOUD_TRACE_CONTEXT_HEADER_NAME = 'x-cloud-trace-context'
const CLOUD_TRACE_CONTEXT_HEADER_FORMAT = /^(?<traceId>[a-f0-9]+)\/(?<spanId>[0-9]+)(?:;o=(?<sampled>[01]))?$/i

const TRACE_PARENT_FLAGS = {
   sampled: 0b00000001,
}

/**
 * @typedef {{ trace: string, spanId: string, traceSampled: boolean }} TraceContext
 * @param {string} projectId
 * @param {import('./StructuredLogger').Request} req
 * @returns {{} | TraceContext}
 */
function extractTraceContext(projectId, req) {
   /** @type {string | undefined} */
   let traceId
   /** @type {string | undefined | bigint} */
   let spanId
   /** @type {number} */
   let flagsValue = 0
   const traceparent = /** @type {{ traceId: string, spanId: string, flags: string } | undefined} */(TRACEPARENT_HEADER_FORMAT_V0.exec(getHeader(req, TRACEPARENT_HEADER_NAME))?.groups)
   if (traceparent) {
      traceId = traceparent.traceId
      spanId = `0x${traceparent.spanId}`
      flagsValue = Number.parseInt(traceparent.flags, 16)
   }
   const cloudTraceContext = /** @type {{ traceId: string, spanId: string, sampled?: '0' | '1' }} */(CLOUD_TRACE_CONTEXT_HEADER_FORMAT.exec(getHeader(req, CLOUD_TRACE_CONTEXT_HEADER_NAME))?.groups)
   if (cloudTraceContext) {
      ({ traceId, spanId } = cloudTraceContext)
      if (cloudTraceContext.sampled !== '0') flagsValue = 0b00000001 // Convert to newer flags format
   }
   try {
      if (traceId === '00000000000000000000000000000000') throw Error('Null traceId')
      if (!spanId || BigInt(spanId) === 0n) throw Error('Null spanId')
      spanId = BigInt(spanId)
   } catch {
      // Can ignore - invalid values
      return {}
   }
   return { trace: `projects/${projectId}/traces/${traceId}`, spanId: spanId.toString(16).padStart(16, '0'), traceSampled: Boolean(flagsValue & TRACE_PARENT_FLAGS.sampled) }
}

module.exports = {
   extractTraceContext,
}
