const { StructuredLogger } = require('./src/StructuredLogger')
const { LogSeverity } = require('./src/severity')
const { Http2RequestHeaders } = require('./src/http2-request-headers')
const asyncContext = require('./src/async-context')
const expressAdapter = require('./express')
const nextAdapter = require('./next')

/**
 * Re-export the public types from the package root for backwards compatibility.
 * @typedef {import('./src/types').LoggingConfig} LoggingConfig
 * @typedef {import('./src/types').ServiceContext} ServiceContext
 * @typedef {import('./src/types').LogEntry} LogEntry
 * @typedef {import('./src/types').TransportLogEntry} TransportLogEntry
 * @typedef {import('./src/types').LoggingHttpRequest} LoggingHttpRequest
 * @typedef {import('./src/types').TraceContext} TraceContext
 * @typedef {import('./src/types').ExtractUser} ExtractUser
 * @typedef {import('./src/types').Transport} Transport
 * @typedef {import('./src/StructuredLogger').StructuredTracedLogger} StructuredTracedLogger
 * @typedef {import('./src/StructuredLogger').StructuredContextLogger} StructuredContextLogger
 * @typedef {import('./src/StructuredLogger').StructuredRequestLogger} StructuredRequestLogger
 */

/**
 * An HTTP2 server request with the request logger attached as a `.log` property by
 * {@link Logging.http2RequestListener}.
 * @typedef {import('node:http2').Http2ServerRequest & { readonly log: StructuredRequestLogger }} Http2ServerRequestWithLog
 */

/**
 * An HTTP2 server stream with the request logger attached as a `.log` property by
 * {@link Logging.http2StreamListener}.
 * @typedef {import('node:http2').ServerHttp2Stream & { readonly log: StructuredRequestLogger }} ServerHttp2StreamWithLog
 */

class Logging {

   /** @param {import('./src/types').LoggingConfig} opts */
   constructor({ projectId, logName, serviceContext, requestUserExtractor, extraLabels, productionTransport }) {
      /** @readonly @private */
      this._serviceContext = Object.freeze({ ...serviceContext })
      /** @readonly @private */
      this._extraLabels = Object.assign({}, extraLabels)
      /** @readonly @private */
      this._extractUser = requestUserExtractor
      /** @readonly */
      this.logger = new StructuredLogger(projectId, logName, serviceContext, productionTransport, this._extraLabels)
      /** @readonly @private This instance's own active-logger scope, isolated from other `Logging` instances. */
      this._loggerContext = asyncContext.createLoggerContext()
   }

   /**
    * Builds an enriched logger from a plain context object — usable from any transport
    * (Express, Next.js, Slack Bolt, …), not just from an HTTP request.
    * @param {object} [context]
    * @param {string | { traceId: string, spanId?: string, sampled?: boolean } | import('./src/types').TraceContext} [context.trace] A trace-id string, a friendly `{ traceId, … }` descriptor, or an extracted `TraceContext` (e.g. from `extractTraceContext`).
    * @param {import('./src/request-transformers').HttpRequestContext | (() => import('./src/request-transformers').HttpRequestContext | undefined)} [context.httpRequest] HTTP request info for Error Reporting; may be a value or a thunk resolved at report time.
    * @param {string | null | void | (() => string | null | void)} [context.user] User for Error Reporting; may be a value or a thunk.
    * @param {{ [key: string]: string }} [context.labels] Extra labels applied to all logs from this logger.
    */
   makeContextLogger({ trace, httpRequest, user, labels } = {}) {
      /** @type {Partial<import('./src/types').TraceContext> | undefined} */
      let resolvedTrace
      if (typeof trace === 'string') {
         resolvedTrace = this.logger._normalizeTrace({ traceId: trace })
      } else if (trace && typeof trace === 'object') {
         resolvedTrace = 'traceId' in trace ? this.logger._normalizeTrace(trace) : trace
      }
      return this.logger._contextChild({ trace: resolvedTrace, httpRequest, user, labels })
   }

   /**
    * @param {{ traceId: string, spanId?: string, sampled?: boolean }} trace
    */
   makeTracedLogger(trace) {
      return this.logger._traced(trace)
   }

   /**
    * Runs `fn` with `logger` installed as the active logger (opt-in `AsyncLocalStorage`).
    * Also available framework-free from `gcp-structured-logger/context`.
    * @template T
    * @param {import('./src/StructuredLogger').StructuredLogger} logger
    * @param {() => T} fn
    * @returns {T}
    */
   runWithLogger(logger, fn) {
      return this._loggerContext.runWithLogger(logger, fn)
   }

   /**
    * Returns the active logger set by this instance's `runWithLogger`, falling back to this
    * instance's base `logger` when called outside any scope.
    * @returns {import('./src/StructuredLogger').StructuredLogger}
    */
   activeLogger() {
      return this._loggerContext.activeLogger() ?? this.logger
   }

   /**
    * @package
    * @param {import('./src/types').Request} req
    */
   _makeRequestLog(req) {
      // @ts-ignore
      return this.logger._requestChild(req, this._extractUser)
   }

   /**
    * @deprecated Import from `gcp-structured-logger/express` instead: `makeLoggingMiddleware(logging, opts)`.
    * @param {{ als?: boolean }} [opts] Forwarded to the Express adapter (e.g. `{ als: true }`).
    * @returns {(req: any, res: any, next: (err?: any) => void) => void} An Express `RequestHandler`.
    */
   makeLoggingMiddleware(opts) {
      return expressAdapter.makeLoggingMiddleware(this, opts)
   }

   /**
    * @deprecated Import from `gcp-structured-logger/express` instead: `makeErrorMiddleware(logging)`.
    *
    * This should be attached after adding the result of `makeLoggingMiddleware`.
    * @returns {(err: any, req: any, res: any, next: (err?: any) => void) => void} An Express `ErrorRequestHandler`.
    */
   makeErrorMiddleware() {
      return expressAdapter.makeErrorMiddleware(this)
   }

   /**
    * @param {(req: Http2ServerRequestWithLog, res: import('node:http2').Http2ServerResponse) => void} listener
    * @returns {(req: import('node:http2').Http2ServerRequest, res: import('node:http2').Http2ServerResponse) => void}
    */
   http2RequestListener(listener) {
      return (req, res) => listener(/** @type {any} */(Object.defineProperty(req, 'log', { value: this._makeRequestLog(new Http2RequestHeaders(req.headers)), enumerable: true, configurable: false })), res)
   }

   /**
    * @param {(stream: ServerHttp2StreamWithLog, headers: import('node:http2').IncomingHttpHeaders & import('node:http2').IncomingHttpStatusHeader, flags: number, rawHeaders: string[]) => void} listener
    * @returns {(stream: import('node:http2').ServerHttp2Stream, headers: import('node:http2').IncomingHttpHeaders & import('node:http2').IncomingHttpStatusHeader, flags: number, rawHeaders: string[]) => void}
    */
   http2StreamListener(listener) {
      return (stream, headers, ...args) => listener(/** @type {any} */(Object.defineProperty(stream, 'log', { value: this._makeRequestLog(new Http2RequestHeaders(headers)), enumerable: true, configurable: false })), headers, ...args)
   }

   /**
    * @deprecated Import from `gcp-structured-logger/next` instead: `nextJSMiddleware(logging, req)`.
    * @param {import('./src/types').Request} req
    */
   nextJSMiddleware(req) {
      // @ts-ignore - the deprecated method accepts a loose structural request for back-compat
      nextAdapter.nextJSMiddleware(this, req)
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

const { requestToHttpRequest, requestToErrorReportingHttpRequest } = require('./src/request-transformers')
const { extractTraceContext } = require('./src/trace-context')

module.exports = {
   Logging,
   LogSeverity,
   requestToHttpRequest,
   requestToErrorReportingHttpRequest,
   extractTraceContext,
}
