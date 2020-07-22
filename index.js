const { finished } = require('stream')
const semverGte = require('semver/functions/gte')
const { ErrorReporting } = require('@google-cloud/error-reporting')
const { StructuredLogger } = require('./src/StructuredLogger')
const { LogSeverity } = require('./src/severity')

/**
 * @typedef {{ service: string, version?: string }} ServiceContext
 *
 *
 * @typedef {InstanceType<import('./src/StructuredLogger')['StructuredLogger']>} StructuredLogger
 * @typedef {import('./src/StructuredLogger').StructuredRequestLogger} StructuredRequestLogger
 *
 * @typedef {import('express').Request & { readonly log: StructuredRequestLogger }} Request
 */

class Logging {

   /**
    * @typedef {object} Options
    * @prop {string} projectId GCP project ID.
    * @prop {string} logName Used for `log_name` label.
    * @prop {ServiceContext} serviceContext Used for error reporting.
    * @prop {import('./src/StructuredLogger').ExtractUser} [requestUserExtractor] Function to get a user from a request to apply to error reports.
    * @prop {{ [labelName: string]: string }} [extraLabels={}] Extra labels to apply to all logs.
    *
    * @param {Options} opts
    */
   constructor({ projectId, logName, serviceContext, requestUserExtractor, extraLabels }) {
      /** @readonly @private */
      this._errorReporter = new ErrorReporting({
         serviceContext,
         reportUnhandledRejections: false,
         // Don't report the errors - we'll manually log errors to include other info
         reportMode: 'never',
      })
      /** @readonly @private */
      this._extraLabels = Object.assign({}, extraLabels)
      /** @readonly @private */
      this._extractUser = requestUserExtractor
      /** @readonly */
      this.logger = new StructuredLogger(projectId, logName, this._errorReporter, extraLabels)
   }

   /**
    * @private
    * @param {import('express').Request} req
    */
   _makeRequestLog(req) {
      // @ts-ignore
      return this.logger._requestChild(req, this._extractUser)
   }

   /** @returns {import('express').RequestHandler} */
   makeLoggingMiddleware() {
      return (req, res, next) => {
         Object.defineProperty(req, 'log', { value: this._makeRequestLog(req), enumerable: true, configurable: false })
         next()
      }
   }

   /**
    * This should be attached after adding the result of `makeLoggingMiddleware`
    * @returns  {import('express').ErrorRequestHandler}
    */
   makeErrorMiddleware() {
      return (err, /** @type {Request} */ req, res, next) => {
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

      // https://nodejs.org/docs/latest-v12.x/api/process.html#process_event_uncaughtexceptionmonitor
      /* istanbul ignore next */
      const uncaughtExceptionType = semverGte(process.version, '12.17.0') ? 'uncaughtExceptionMonitor' : 'uncaughtException'

      process.on('unhandledRejection', onUnhandledRejection)
      process.on(uncaughtExceptionType, onUncaughtException)

      return function detachFromProcess() {
         process.off('unhandledRejection', onUnhandledRejection)
         process.off(uncaughtExceptionType, onUncaughtException)
      }
   }
}

const { requestToHttpRequest } = require('./src/request-transformers')

module.exports = {
   Logging,
   LogSeverity,
   requestToHttpRequest,
}
