/**
 * Converts a request (and its attached response) to a HttpRequest for Stackdriver LogEntry.
 * See https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#httprequest
 *
 * @typedef {object} LoggingHttpRequest
 * @prop {string} requestMethod
 * @prop {string} requestUrl
 * @prop {?string} [remoteIp]
 * @prop {?string} [referer]
 * @prop {?string} [userAgent]
 * @prop {?string} [protocol]
 * @prop {?number} [status]
 * @prop {?number} [requestSize]
 * @prop {?number} [responseSize]
 * @prop {?{ seconds: number, nanos?: number }} [latency]
 *
 * @param {import('express').Request} req
 * @returns {LoggingHttpRequest}
 */
function requestToHttpRequest(req) {
   // Copy from reporting
   const { url, method, ...reportingReq } = requestToErrorReportingHttpRequest(req)
   /** @type {LoggingHttpRequest} */
   const httpReq = {
      requestUrl: url,
      requestMethod: method,
   }
   if ('remoteAddress' in reportingReq) httpReq.remoteIp = reportingReq.remoteAddress
   if ('referrer' in reportingReq) httpReq.referer = reportingReq.referrer
   if ('userAgent' in reportingReq) httpReq.userAgent = reportingReq.userAgent
   if ('statusCode' in reportingReq) httpReq.status = reportingReq.statusCode

   // Add in extra request info
   const requestSize = req.get('content-length')
   if (requestSize !== undefined) httpReq.requestSize = parseInt(requestSize)
   if (req.protocol) httpReq.protocol = req.protocol + '/' + req.httpVersion

   if (req.res) {
      // Response info
      const responseSize = req.res.get('content-length')
      if (responseSize !== undefined) httpReq.responseSize = parseInt(responseSize)
   }

   return httpReq
}

/**
 * Converts a request (and its attached response) to a HttpRequestContext for Stackdriver error reporting.
 * See https://cloud.google.com/error-reporting/reference/rest/v1beta1/ErrorContext#httprequestcontext
 *
 * @param {import('express').Request} req
 */
function requestToErrorReportingHttpRequest(req) {
   /** @type {import('@google-cloud/error-reporting/build/src/request-extractors/manual').Request} */
   const httpReq = {
      url: req.originalUrl,
      method: req.method,
      remoteAddress: req.ip || (Array.isArray(req.ips) ? req.ips[0] : null)
   }

   if (!httpReq.remoteAddress) {
      const headerIps = req.get('x-forwarded-for')
      if (headerIps && (!Array.isArray(headerIps) || headerIps.length > 0)) {
         httpReq.remoteAddress = Array.isArray(headerIps) ? headerIps[0] : headerIps
      } else {
         delete httpReq.remoteAddress
      }
   }

   const userAgent = req.get('user-agent')
   if (userAgent !== undefined) httpReq.userAgent = userAgent

   const referrer = req.get('referrer')
   if (referrer !== undefined) httpReq.referrer = referrer

   if (req.res) httpReq.statusCode = req.res.statusCode

   return httpReq
}

module.exports = {
   requestToHttpRequest,
   requestToErrorReportingHttpRequest,
}
