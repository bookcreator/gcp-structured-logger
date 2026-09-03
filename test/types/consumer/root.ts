// The consumer programs in this directory import the package by name. Node and
// TypeScript resolve a package's own name through its `exports` map, so this
// exercises the real map, with nothing installed, exactly as a consumer sees it.
import { Logging, LogSeverity, requestToHttpRequest, extractTraceContext } from 'gcp-structured-logger'
import type { LogEntry, LoggingConfig, StructuredLogger, StructuredRequestLogger } from 'gcp-structured-logger'
import type { IncomingMessage, ServerResponse } from 'node:http'

declare const req: IncomingMessage & { url: string, method: string }
declare const res: ServerResponse

const config: LoggingConfig = { projectId: 'p', logName: 'l', serviceContext: { service: 's', version: '1' } }
const logging = new Logging(config)

const logger: StructuredLogger = logging.logger
logger.info('hello', { some: 'data' })
logger.reportError(new Error('boom'))
logging.makeTracedLogger({ traceId: 'abc' }).warn('traced')
logging.makeLoggingMiddleware()(req, res, () => {})
logging.http2RequestListener((h2req) => { const log: StructuredRequestLogger = h2req.log; log.debug('h2') })

const severity: LogEntry['severity'] = LogSeverity.NOTICE
const method: string = requestToHttpRequest(req).requestMethod
const traceId: string | undefined = extractTraceContext('p', req)?.trace

// Each probe must fail to compile. If the src declarations were missing these
// types would be `any`, the lines would compile, and TypeScript would report
// the directives as unused (TS2578).
// @ts-expect-error - StructuredLogger has no such method
logger.notAMethod()
// @ts-expect-error - LogEntry.severity is the LogSeverity union, not any string
const badSeverity: LogEntry['severity'] = 'VERBOSE'
// @ts-expect-error - LogSeverity has no such member
void LogSeverity.VERBOSE
// @ts-expect-error - LoggingHttpRequest has no such property
void requestToHttpRequest(req).notAProperty
// @ts-expect-error - extractTraceContext can return undefined
void extractTraceContext('p', req).trace
