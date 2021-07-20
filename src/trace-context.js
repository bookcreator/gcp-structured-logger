/** Header that carries span context across Google infrastructure. */
const TRACE_CONTEXT_HEADER_NAME = 'x-cloud-trace-context'
const TRACE_CONTEXT_HEADER_FORMAT = /^([0-9a-fA-F]+)(?:\/([0-9]+))(?:;o=(.*))?/

/**
 * @param {string} projectId
 * @param {import('express-serve-static-core').Request} req
 * @returns {{} | { trace: string, spanId: string }}
 */
module.exports = function extractTraceContext(projectId, req) {
   const traceContextHeader = req.get(TRACE_CONTEXT_HEADER_NAME)
   const matches = TRACE_CONTEXT_HEADER_FORMAT.exec(traceContextHeader)
   if (matches && matches.length === 4 && matches[0] === traceContextHeader) {
      try {
         return {
            /** `projects/<PROJECT-ID>/traces/<TRACE-ID>` */
            trace: `projects/${projectId}/traces/${matches[1]}`,
            // Convert spanId to hex and ensure its always a length-16 hex string
            spanId: BigInt(matches[2]).toString(16).padStart(16, '0'),
         }
      } /* c8 ignore next */ catch { /* Bad span number */ }
   }
   return {}
}
