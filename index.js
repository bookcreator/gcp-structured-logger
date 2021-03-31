const { finished } = require('stream')
const { ErrorReporting } = require('@google-cloud/error-reporting')
const { StructuredLogger } = require('./src/StructuredLogger')
const { LogSeverity } = require('./src/severity')

const ERROR_REPORTING_PROP = '__errorReporter'

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
      this.logger = new StructuredLogger(projectId, logName, () => this._errorReporter, productionTransport, extraLabels)
   }

   /**
    * @private
    * Used for all child logs of this Logging instance, lazily loaded.
    */
   get _errorReporter() {
      /** @type {import('@google-cloud/error-reporting').ErrorReporting} */
      let e
      if (ERROR_REPORTING_PROP in this) {
         e = this[ERROR_REPORTING_PROP]
      } else {
         e = new ErrorReporting({
            serviceContext: this._serviceContext,
            reportUnhandledRejections: false,
            // Don't report the errors - we'll manually log errors to include other info
            reportMode: 'never',
         })
         Object.defineProperty(this, ERROR_REPORTING_PROP, { value: e, enumerable: false, configurable: false })
      }
      return e
   }

   /**
    * @private
    * @param {import('express-serve-static-core').Request} req
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

      const uncaughtExceptionType = Logging._resolveUncaughtExceptionType()

      process.on('unhandledRejection', onUnhandledRejection)
      process.on(uncaughtExceptionType, onUncaughtException)

      return function detachFromProcess() {
         process.off('unhandledRejection', onUnhandledRejection)
         process.off(uncaughtExceptionType, onUncaughtException)
      }
   }

   /**
    * @private
    * @see https://nodejs.org/docs/latest-v12.x/api/process.html#process_event_uncaughtexceptionmonitor
    * @param {string} version
    */
   static _resolveUncaughtExceptionType(version = process.version) {
      // vX.Y.Z
      const versionArgs = /^v?(\d+)\.(\d+)(?:\.\d+)?$/.exec(version)
      if (versionArgs) {
         const [major, minor] = [parseInt(versionArgs[1]), parseInt(versionArgs[2])]
         if (major > 13 || (major === 13 && minor >= 7) || (major === 12 && minor >= 17)) {
            // Added in v12.17.0 and v13.7.0
            return 'uncaughtExceptionMonitor'
         }
      }
      return 'uncaughtException'
   }
}

const { requestToHttpRequest } = require('./src/request-transformers')

module.exports = {
   Logging,
   LogSeverity,
   requestToHttpRequest,
}
