const { finished } = require('stream')
const { StructuredLogger } = require('./src/StructuredLogger')
const { LogSeverity } = require('./src/severity')
const { Http2RequestHeaders } = require('./src/http2-request-headers')

class Logging {

   /** @param {import('./').LoggingConfig} opts */
   constructor({ projectId, logName, serviceContext, requestUserExtractor, extraLabels, productionTransport }) {
      /** @readonly @private */
      this._serviceContext = Object.freeze({ ...serviceContext })
      /** @readonly @private */
      this._extraLabels = Object.assign({}, extraLabels)
      /** @readonly @private */
      this._extractUser = requestUserExtractor
      /** @readonly */
      this.logger = new StructuredLogger(projectId, logName, serviceContext, productionTransport, extraLabels)
   }

   /**
    * @param {{ traceId: string, spanId?: string, sampled?: boolean }} trace
    */
   makeTracedLogger(trace) {
      return this.logger._traced(trace)
   }

   /**
    * @private
    * @param {import('./src/StructuredLogger').Request} req
    */
   _makeRequestLog(req) {
      // @ts-ignore
      return this.logger._requestChild(req, this._extractUser)
   }

   /** @returns {import('express-serve-static-core').RequestHandler} */
   makeLoggingMiddleware() {
      return (req, res, next) => {
         Object.defineProperty(req, 'log', { value: this._makeRequestLog(req), enumerable: true, configurable: false })
         next()
      }
   }

   /**
    * This should be attached after adding the result of `makeLoggingMiddleware`
    * @returns  {import('express-serve-static-core').ErrorRequestHandler}
    */
   makeErrorMiddleware() {
      return (err, /** @type {import('express-serve-static-core').Request} */ req, res, next) => {
         const self = this
         // Log client errors (400) as warnings
         const asWarning = (err.statusCode || err.status) < 500
         // Report after request finished so the error gets the final status code
         const resFinishedCleanup = finished(res, function onResponseFinished() {
            resFinishedCleanup()
            const log = req.log || self._makeRequestLog(req)
            log.reportError(err, asWarning ? LogSeverity.WARNING : undefined)
         })
         next(err)
      }
   }

   /**
    * @param {(req: import('./').Http2ServerRequestWithLog, res: import('node:http2').Http2ServerResponse) => void} listener
    * @returns {(req: import('node:http2').Http2ServerRequest, res: import('node:http2').Http2ServerResponse) => void}
    */
   http2RequestListener(listener) {
      return (req, res) => listener(/** @type {any} */(Object.defineProperty(req, 'log', { value: this._makeRequestLog(new Http2RequestHeaders(req.headers)), enumerable: true, configurable: false })), res)
   }

   /**
    * @param {(stream: import('./').ServerHttp2StreamWithLog, headers: import('node:http2').IncomingHttpHeaders & import('node:http2').IncomingHttpStatusHeader, flags: number, rawHeaders: string[]) => void} listener
    * @returns {(stream: import('node:http2').ServerHttp2Stream, headers: import('node:http2').IncomingHttpHeaders & import('node:http2').IncomingHttpStatusHeader, flags: number, rawHeaders: string[]) => void}
    */
   http2StreamListener(listener) {
      return (stream, headers, ...args) => listener(/** @type {any} */(Object.defineProperty(stream, 'log', { value: this._makeRequestLog(new Http2RequestHeaders(headers)), enumerable: true, configurable: false })), headers, ...args)
   }

   /**
    * @param {import('next/server').NextRequest} req
    */
   nextJSMiddleware(req) {
      Object.defineProperty(req, 'log', { value: this._makeRequestLog(req), enumerable: true, configurable: false })
   }

   /**
    * @param {StructuredLogger} loggingTo
    * @returns A function to call to detach from the process
    */
   attachToProcess(loggingTo) {

      const onUnhandledRejection = reason => {
         loggingTo.reportError(reason, LogSeverity.WARNING)
      }
      const onUncaughtException = (err, origin) => {
         err.uncaughtExceptionType = origin
         loggingTo.reportError(err)
      }

      process.on('unhandledRejection', onUnhandledRejection)
      process.on('uncaughtExceptionMonitor', onUncaughtException)

      return function detachFromProcess() {
         process.off('unhandledRejection', onUnhandledRejection)
         process.off('uncaughtExceptionMonitor', onUncaughtException)
      }
   }
}

const { requestToHttpRequest } = require('./src/request-transformers')
const { extractTraceContext } = require('./src/trace-context')

module.exports = {
   Logging,
   LogSeverity,
   requestToHttpRequest,
   extractTraceContext,
}
