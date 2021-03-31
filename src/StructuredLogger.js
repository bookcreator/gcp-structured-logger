const { format, formatWithOptions } = require('util')
const { LogSeverity, CONSOLE_SEVERITY } = require('./severity')
const cleanupForJSON = require('./cleanup-for-json')
const getTraceContext = require('./trace-context')
const { requestToErrorReportingHttpRequest } = require('./request-transformers')

/**
 * @typedef {object} LogEntry
 * @prop {Date} timestamp
 * @prop {LogSeverity} severity
 * @prop {?string} [insertId]
 * @prop {?import('./request-transformers').LoggingHttpRequest} [httpRequest]
 * @prop {?{ [k: string]: string }} [labels]
 * @prop {?string} [trace] Format `projects/<PROJECT-ID>/traces/<TRACE-ID>`
 * @prop {?string} [spanId]
 * @prop {?boolean} [traceSampled]
 * @prop {?{ id: string, producer?: string, first?: boolean, last?: boolean }} [operation]
 * @prop {?{ file?: string, line?: number | string, function?: string }} [sourceLocation]
 * @prop {?string} [textPayload]
 * @prop {?any} [jsonPayload]
 * @prop {?any} [protoPayload]
 */
/**
 * @type {Partial<Record<keyof LogEntry, string | false>>}
 * `false` will not map.
 *  Missing values will just use the key name.
 *  @see https://cloud.google.com/logging/docs/agent/configuration#special-fields
 */
const LOG_ENTRY_MAPPING = {
   timestamp: false,
   textPayload: false,
   jsonPayload: false,
   protoPayload: false,
   insertId: 'logging.googleapis.com/insertId',
   labels: 'logging.googleapis.com/labels',
   operation: 'logging.googleapis.com/operation',
   sourceLocation: 'logging.googleapis.com/sourceLocation',
   spanId: 'logging.googleapis.com/spanId',
   trace: 'logging.googleapis.com/trace',
   traceSampled: 'logging.googleapis.com/trace_sampled',
   // @ts-ignore - Include this so we never overwrite the message
   message: false,
}

class StructuredLogger {

   /**
    * @param {string} projectId
    * @param {string} logName
    * @param {() => import('@google-cloud/error-reporting').ErrorReporting} errorReporter
    * @param {{ [key: string]: string }} labels
    */
   constructor(projectId, logName, errorReporter, labels) {
      /** @readonly @private */
      this._projectId = projectId
      /** @readonly @private */
      this._logName = logName
      /** @readonly @private */
      this._errorReporter = errorReporter
      /** @readonly @private */
      this._labels = Object.assign({ log_name: logName }, labels)
   }

   /** @param {string} type */
   child(type) {
      return new StructuredLogger(this._projectId, this._logName, this._errorReporter, { ...this._labels, type })
   }

   /**
    * @private
    * @param {import('express-serve-static-core').Request} request
    * @param {?import('../').ExtractUser} extractUser
    */
   _requestChild(request, extractUser) {
      return new StructuredRequestLogger(this._projectId, this._logName, this._errorReporter, { ...this._labels, type: 'request' }, request, extractUser)
   }

   /** @param {any[]} args */
   log(...args) {
      this._writeFormatted(LogSeverity.DEFAULT, args)
   }

   /** @param {any[]} args */
   debug(...args) {
      this._writeFormatted(LogSeverity.DEBUG, args)
   }

   /** @param {any[]} args */
   info(...args) {
      this._writeFormatted(LogSeverity.INFO, args)
   }

   /** @param {any[]} args */
   notice(...args) {
      this._writeFormatted(LogSeverity.NOTICE, args)
   }

   /** @param {any[]} args */
   warn(...args) {
      this._writeFormatted(LogSeverity.WARNING, args)
   }

   /** @param {any[]} args */
   error(...args) {
      this._writeFormatted(LogSeverity.ERROR, args)
   }

   /** @param {any[]} args */
   critical(...args) {
      this._writeFormatted(LogSeverity.CRITICAL, args)
   }

   /** @param {any[]} args */
   alert(...args) {
      this._writeFormatted(LogSeverity.ALERT, args)
   }

   /** @param {any[]} args */
   emergency(...args) {
      this._writeFormatted(LogSeverity.EMERGENCY, args)
   }

   /**
    * @param {any} err
    * @param {LogSeverity} [severity] If not provided `err.severity` will be used, falling back to `LogSeverity.ERROR`
    */
   reportError(err, severity) {
      const timestamp = new Date()
      if (!severity) {
         severity = LogSeverity.ERROR
         if (err && typeof err === 'object' && err.severity) severity = err.severity
      }
      const event = this._makeReportableError(this._errorReporter(), err)
      // Remove report location as the stack trace is used
      delete event.context.reportLocation
      if (!event.context.user) delete event.context.user
      if (!event.context.user && !event.context.httpRequest) delete event.context
      if (event.message.indexOf(__filename) !== -1) {
         // Stack contains this function - remove that line
         event.message = event.message.replace(reportErrorMatcher, '')
      }
      // If we had an error object copy over enumerable properties
      if (err && typeof err === 'object') {
         // @ts-ignore
         const { message: _message, stack: _stack, ...props } = err
         // @ts-ignore
         event.error = props
      }
      this._write({ severity, timestamp }, event)
   }

   /**
    * @protected
    * @param {import('@google-cloud/error-reporting').ErrorReporting} errorReporter
    * @param {any} err
    */
   _makeReportableError(errorReporter, err) {
      const event = errorReporter.report(err)
      delete event.context.httpRequest
      return event
   }

   /**
    * @private
    * @param {LogSeverity} severity
    * @param {any[]} args
    * @param {Date} [timestamp]
    */
   _writeFormatted(severity, args, timestamp = new Date()) {
      let data
      const [message, ...a] = args
      if (a.length === 0) {
         // Use first item (which might or might not be an actual message as the data)
         data = message
      } else if (a.length >= 1 && typeof message === 'string') {
         if (a.length === 1 && (a[0] !== null && typeof a[0] === 'object' && !('message' in a[0]) && !(a[0] instanceof Set || a[0] instanceof Map || a[0] instanceof Date || a[0] instanceof RegExp))) {
            // If we've only got 1 extra object at the end and it has no message spread the object along with the message so we get a nice jsonPayload and message
            data = { ...a[0], message }
         } else {
            data = `${message}`
            const restOfArgs = []
            for (const s of a) {
               if (restOfArgs.length === 0) {
                  if (typeof s !== 'object' || s === null) {
                     data += ' ' + String(s)
                  } else if (s instanceof Date) {
                     data += ' ' + s.toISOString()
                  } else if (s instanceof RegExp) {
                     data += ` /${s.source}/${s.flags}`
                  } else {
                     restOfArgs.push(s)
                  }
               } else {
                  // Can't stringify everything - prioritise the message and just use the number keyed array as the rest of the object
                  restOfArgs.push(s)
               }
            }
            if (restOfArgs.length > 0) data = { ...restOfArgs, message: data, }
         }
      } else {
         // Just use the number keyed array as the rest of the object
         data = { ...args }
      }
      this._write({ timestamp, severity }, data)
   }

   /**
    * @protected
    * @param {LogEntry} metadata
    * @param {object | string} data
    */
   _write({ timestamp, ..._metadata }, data) {
      /** @type {LogEntry} */
      const metadata = {
         timestamp,
         ..._metadata,
         labels: Object.assign({}, this._labels, _metadata.labels)
      }
      if (data && typeof data === 'object' && 'eventTime' in data) {
         // ErrorMessage
         const eventTime = new Date(data.eventTime)
         // Use the error event timestamp instead (as long as its valid)
         if (!isNaN(eventTime.getTime())) metadata.timestamp = eventTime
      }

      if (!(metadata.severity in LogSeverity)) {
         process.emitWarning(`Unknown LogSeverity '${metadata.severity}', falling back to LogSeverity.${LogSeverity.DEFAULT}`, undefined, this._write)
         metadata.severity = LogSeverity.DEFAULT
      }
      const fn = CONSOLE_SEVERITY[metadata.severity].bind(console)

      const { message, ...messageData } = (() => {
         if (typeof data === 'object' && data) {
            return data
         } else /* istanbul ignore else */ if (typeof data === 'string') {
            return { message: data }
         } else if (typeof data !== 'undefined') {
            return { message: format(data) }
         } else {
            return {}
         }
      })()

      if (process.env.NODE_ENV === 'production') {
         // See https://cloud.google.com/logging/docs/agent/configuration#timestamp-processing
         const timestamp = (() => {
            const ms = metadata.timestamp.getTime()
            const seconds = Math.floor(ms / 1000)
            const nanos = (ms - (seconds * 1000)) * 1e6
            return { seconds, nanos }
         })()

         // See https://cloud.google.com/run/docs/logging#container-logs
         const entry = {
            message,
            timestamp
         }
         for (const key in metadata) {
            // Check if we should add the key to a structured log
            const lookup = LOG_ENTRY_MAPPING[key]
            if (lookup === false) continue // Ignore
            // If we've got no transform, just use the property name
            entry[lookup || key] = metadata[key]
         }
         for (const k in entry) {
            if (k in messageData) {
               // Conflicting key - wrap extra in property
               entry.messageData = messageData
               break
            }
         }
         if (!('messageData' in entry)) Object.assign(entry, messageData) // If we've not wrapped, add in the extra metadata at the root
         fn(JSON.stringify(cleanupForJSON(entry)))
      } else {
         let prefix = metadata.timestamp.toISOString()
         if (metadata.trace) prefix += ' / ' + metadata.trace.replace(/.+\//, '')
         /** @type {any[]} */
         const args = []
         if (message) args.push(message)
         if (Object.keys(messageData).length) args.push(messageData)
         fn(formatWithOptions({
            depth: null,
            colors: true,
         }, `[${prefix}]`, ...args))
      }
   }
}

class StructuredRequestLogger extends StructuredLogger {

   /**
    * @param {string} projectId
    * @param {string} logName
    * @param {() => import('@google-cloud/error-reporting').ErrorReporting} errorReporter
    * @param {{ [key: string]: string }} labels
    * @param {import('express-serve-static-core').Request} request
    * @param {?import('../').ExtractUser} extractUser
    */
   constructor(projectId, logName, errorReporter, labels, request, extractUser) {
      super(projectId, logName, errorReporter, labels)
      /** @readonly @private */
      this._request = request
      /** @readonly @private */
      this._extractUser = extractUser
      /** @readonly @private */
      this._trace = getTraceContext(projectId, request)
   }

   /**
    * @param {import('@google-cloud/error-reporting').ErrorReporting} errorReporter
    * @param {any} err
    */
   _makeReportableError(errorReporter, err) {
      // Add in request and user info
      const event = errorReporter.report(err, requestToErrorReportingHttpRequest(this._request))
      if (typeof this._extractUser === 'function') {
         const user = this._extractUser(this._request)
         if (user) event.setUser(user)
      }
      return event
   }

   /**
    * @param {LogEntry} entry
    * @param {object | string} data
    */
   _write(entry, data) {
      // Inject trace
      super._write({ ...this._trace, ...entry }, data)
   }
}

/**
 * Matches:
 * *`    at <CLS>.reportError (<__filename>:<LN>:<CN>)`
 * *`    at <CLS>._makeReportableError (<__filename>:<LN>:<CN>)`
 * Or with source maps:
 * *```
 *       at <CLS>.reportError (<__filename>:<LN>:<CN>)
 *          -> <__filename>:<LN>:<CN>
 * ```
 * *```
 *       at <CLS>._makeReportableError (<__filename>:<LN>:<CN>)
 *          -> <__filename>:<LN>:<CN>
 * ```
 */
const reportErrorMatcher = new RegExp(`^.+\\.(?:${StructuredLogger.prototype.reportError.name}|${StructuredRequestLogger.prototype._makeReportableError.name}) \\(${__filename}:[0-9]+:[0-9]+\\)$\n(?:\\s*->\\s+${__filename}:[0-9]+:[0-9]+$\n)?`, 'gm')

module.exports = { StructuredLogger, StructuredRequestLogger }
