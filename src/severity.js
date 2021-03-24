const _LogSeverity = {
   DEFAULT: 'DEFAULT',
   DEBUG: 'DEBUG',
   INFO: 'INFO',
   NOTICE: 'NOTICE',
   WARNING: 'WARNING',
   ERROR: 'ERROR',
   CRITICAL: 'CRITICAL',
   ALERT: 'ALERT',
   EMERGENCY: 'EMERGENCY',
}

/**
 * @enum {keyof _LogSeverity}
 * @see https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#logseverity
 */
const LogSeverity = Object.freeze(/** @type {{ [M in keyof _LogSeverity]: M }} */(_LogSeverity))

/** @type {Record<LogSeverity, console['log']>} */
const CONSOLE_SEVERITY = {
   /* eslint-disable no-console */
   DEFAULT: console.log,
   DEBUG: console.debug,
   INFO: console.info,
   NOTICE: console.info,
   WARNING: console.warn,
   ERROR: console.error,
   CRITICAL: console.error,
   ALERT: console.error,
   EMERGENCY: console.error,
   /* eslint-enable no-console */
}

module.exports = { LogSeverity, CONSOLE_SEVERITY }
