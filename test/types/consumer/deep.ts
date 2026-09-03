// Deep imports worked before the exports map existed (3.1.8). They stay
// reachable through the ./index.js, ./src/* and ./src/*.js entries, which
// also point at the generated declarations.
import { Logging } from 'gcp-structured-logger/index.js'
import { LogSeverity } from 'gcp-structured-logger/src/severity'
import { StructuredLogger } from 'gcp-structured-logger/src/StructuredLogger.js'

declare const logger: StructuredLogger
const severity: 'INFO' = LogSeverity.INFO
logger.info('deep import', severity)
void new Logging({ projectId: 'p', logName: 'l', serviceContext: { service: 's' } })

// @ts-expect-error - the deep import is a real StructuredLogger, not any
logger.notAMethod()
