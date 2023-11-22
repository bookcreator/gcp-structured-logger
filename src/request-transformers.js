const { getUrl, getHeader, getProtocol, getRemoteIp, getResponse } = require('./request-properties')

/** @typedef {import('./StructuredLogger').Request} Request */

/**
 * Converts a request (and its attached response) to a `HttpRequest` for Stackdriver `LogEntry`.
 *
 * @param {Request} req
 * @returns {import('../').LoggingHttpRequest}
 */
function requestToHttpRequest(req) {
   // Copy from reporting
   const { url, method, responseStatusCode, referrer, ...reportingReq } = requestToErrorReportingHttpRequest(req)
   /** @type {import('../').LoggingHttpRequest} */
   const httpReq = {
      requestUrl: url,
      requestMethod: method,
      ...reportingReq,
   }

   if (referrer !== undefined) httpReq.referer = referrer
   if (responseStatusCode !== undefined) httpReq.status = responseStatusCode

   // Add in extra request info
   const protocol = getProtocol(req)
   if (protocol !== undefined) httpReq.protocol = protocol

   const requestSize = getHeader(req, 'content-length')
   if (requestSize !== undefined) httpReq.requestSize = parseInt(requestSize)

   const res = getResponse(req)
   if (res) {
      // Response info
      const responseSize = res.get('content-length')
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
 * @param {Request} req
 */
function requestToErrorReportingHttpRequest(req) {
   /** @type {HttpRequestContext} */
   const httpReq = {
      url: getUrl(req),
      method: req.method,
   }

   const remoteIp = getRemoteIp(req)
   if (remoteIp !== undefined) httpReq.remoteIp = remoteIp

   const userAgent = getHeader(req, 'user-agent')
   if (userAgent !== undefined) httpReq.userAgent = userAgent

   const referrer = getHeader(req, 'referrer')
   if (referrer !== undefined) httpReq.referrer = referrer

   const res = getResponse(req)
   if (res) httpReq.responseStatusCode = res.statusCode

   return httpReq
}

module.exports = {
   requestToHttpRequest,
   requestToErrorReportingHttpRequest,
}
