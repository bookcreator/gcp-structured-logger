const tracePropagation = require('@opencensus/propagation-stackdriver')

/**
 * @param {string} projectId
 * @param {import('express').Request} req
 */
module.exports = function traceContext(projectId, req) {
   const context = tracePropagation.extract({
      getHeader: req.get.bind(req)
   })
   if (!context) return null
   return {
      ...context,
      /** `projects/<PROJECT-ID>/traces/<TRACE-ID>` */
      trace: `projects/${projectId}/traces/${context.traceId}`
   }
}
