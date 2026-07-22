const { finished } = require('stream')
const { LogSeverity } = require('./src/severity')

/**
 * Express logging middleware: attaches a per-request logger as `req.log` so later
 * middleware and handlers can use it.
 *
 * @param {import('./').Logging} logging
 * @param {{ als?: boolean }} [opts] When `als` is set, the rest of the request runs inside
 *    `runWithLogger(req.log, …)` so `activeLogger()` resolves to the request logger anywhere
 *    downstream. Opt-in, with the usual `AsyncLocalStorage` async-boundary caveats.
 * @returns {import('express-serve-static-core').RequestHandler}
 */
function makeLoggingMiddleware(logging, { als = false } = {}) {
   return (req, res, next) => {
      Object.defineProperty(req, 'log', { value: logging._makeRequestLog(req), enumerable: true, configurable: false })
      if (als) {
         logging.runWithLogger(req.log, next)
      } else {
         next()
      }
   }
}

/**
 * Express error handler that reports `next(err)` errors to GCP Error Reporting.
 * Attach this after `makeLoggingMiddleware`.
 *
 * If the `err` has a `statusCode` or `status` property that is less than 500, the error
 * is reported as a warning.
 *
 * @param {import('./').Logging} logging
 * @returns {import('express-serve-static-core').ErrorRequestHandler}
 */
function makeErrorMiddleware(logging) {
   return (err, req, res, next) => {
      // Log client errors (400) as warnings
      const asWarning = (err.statusCode || err.status) < 500
      // Report after request finished so the error gets the final status code
      const resFinishedCleanup = finished(res, function onResponseFinished() {
         resFinishedCleanup()
         const log = req.log || logging._makeRequestLog(req)
         log.reportError(err, asWarning ? LogSeverity.WARNING : undefined)
      })
      next(err)
   }
}

module.exports = { makeLoggingMiddleware, makeErrorMiddleware }
