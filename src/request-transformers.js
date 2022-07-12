/**
 * Converts a request (and its attached response) to a `HttpRequest` for Stackdriver `LogEntry`.
 *
 * @param {import('express-serve-static-core').Request} req
 * @returns {import('../').LoggingHttpRequest}
 */
function requestToHttpRequest(req) {
   // Copy from reporting
   const { url, method, ...reportingReq } = requestToErrorReportingHttpRequest(req)
   /** @type {import('../').LoggingHttpRequest} */
   const httpReq = {
      requestUrl: url,
      requestMethod: method,
   }
   if ('remoteIp' in reportingReq) httpReq.remoteIp = reportingReq.remoteIp
   if ('referrer' in reportingReq) httpReq.referer = reportingReq.referrer
   if ('userAgent' in reportingReq) httpReq.userAgent = reportingReq.userAgent
   if ('responseStatusCode' in reportingReq) httpReq.status = reportingReq.responseStatusCode

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
 * Converts a request (and its attached response) to a `HttpRequestContext` for Stackdriver error reporting.
 * See https://cloud.google.com/error-reporting/reference/rest/v1beta1/ErrorContext#httprequestcontext
 * @typedef {object} HttpRequestContext
 * @prop {string} method
 * @prop {string} url
 * @prop {string} [userAgent]
 * @prop {string} [referrer]
 * @prop {number} [responseStatusCode]
 * @prop {string} [remoteIp]
 *
 * @param {import('express-serve-static-core').Request} req
 */
function requestToErrorReportingHttpRequest(req) {
   /** @type {HttpRequestContext} */
   const httpReq = {
      url: req.originalUrl,
      method: req.method,
      remoteIp: req.ip || (Array.isArray(req.ips) ? req.ips[0] : null)
   }

   if (!httpReq.remoteIp) {
      const headerIps = req.get('x-forwarded-for')
      if (headerIps && (!Array.isArray(headerIps) || headerIps.length > 0)) {
         httpReq.remoteIp = Array.isArray(headerIps) ? headerIps[0] : headerIps
      } else {
         delete httpReq.remoteIp
      }
   }

   const userAgent = req.get('user-agent')
   if (userAgent !== undefined) httpReq.userAgent = userAgent

   const referrer = req.get('referrer')
   if (referrer !== undefined) httpReq.referrer = referrer

   if (req.res) httpReq.responseStatusCode = req.res.statusCode

   return httpReq
}

module.exports = {
   requestToHttpRequest,
   requestToErrorReportingHttpRequest,
}
