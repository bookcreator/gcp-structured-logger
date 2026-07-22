// Compile-only test: proves the PUBLISHED declarations resolve standalone (allowJs:false),
// that the core import pulls no `next` dependency, and that every public type is real
// (not the old circular `any`). Runs with skipLibCheck (Next's own .d.ts don't pass a strict
// node16 lib check); the generated core declarations are strict-checked separately by
// tsconfig.core.json. Both run via `npm run test:types`.
import { Logging, LogSeverity, requestToHttpRequest, requestToErrorReportingHttpRequest, extractTraceContext } from 'gcp-structured-logger'
import type {
   LoggingConfig,
   ServiceContext,
   LogEntry,
   TransportLogEntry,
   LoggingHttpRequest,
   TraceContext,
   ExtractUser,
   Transport,
   StructuredLogger,
   StructuredTracedLogger,
   StructuredContextLogger,
   StructuredRequestLogger,
   Http2ServerRequestWithLog,
   ServerHttp2StreamWithLog,
} from 'gcp-structured-logger'
import { makeLoggingMiddleware, makeErrorMiddleware } from 'gcp-structured-logger/express'
import { nextJSMiddleware } from 'gcp-structured-logger/next'
import { runWithLogger, activeLogger } from 'gcp-structured-logger/context'
import type { Request as ExpressRequest } from 'express-serve-static-core'
import type { NextRequest } from 'next/server'

const config: LoggingConfig = {
   projectId: 'p',
   logName: 'l',
   serviceContext: { service: 's', version: '1' },
   extraLabels: { env: 'test' },
   requestUserExtractor: () => 'user',
   productionTransport: (entry, data) => { void entry; void data },
}
const logging = new Logging(config)

// requestUserExtractor must accept callbacks typed as a framework request, not only the
// structural shape (a narrower param would reject these under strictFunctionTypes).
const expressExtractorConfig: LoggingConfig = { ...config, requestUserExtractor: (req: ExpressRequest) => String(req.get('user-id') ?? '') }
const nextExtractorConfig: LoggingConfig = { ...config, requestUserExtractor: (req: NextRequest) => req.headers.get('user-id') }
// …yet an unannotated callback's req is the structural Request, not `any` (proves we didn't widen to any)
const structuralExtractorConfig: LoggingConfig = {
   ...config,
   requestUserExtractor: (req) => {
      // @ts-expect-error - req is the structural Request, so an unknown property is an error
      void req.notAField
      return null
   },
}
void expressExtractorConfig; void nextExtractorConfig; void structuralExtractorConfig

const base: StructuredLogger = logging.logger
base.info('hi', { extra: 1 })
base.reportError(new Error('boom'), LogSeverity.ERROR)
const child: StructuredLogger = base.child('worker')

const traced: StructuredTracedLogger = logging.makeTracedLogger({ traceId: 'abc', spanId: '1', sampled: true })
traced.warn('traced')

// The Bolt use-case: an enriched logger built from a plain context object.
const trace: TraceContext | undefined = extractTraceContext('p', { method: 'GET', url: '/x', headers: {} })
const ctxLog: StructuredContextLogger = logging.makeContextLogger({
   trace,
   httpRequest: requestToErrorReportingHttpRequest({ method: 'POST', url: '/slack', headers: {} }),
   user: 'U123',
   labels: { type: 'bolt' },
})
ctxLog.reportError('a string error')

// AsyncLocalStorage — instance methods and the framework-free subpath.
const active: StructuredLogger = logging.activeLogger()
logging.runWithLogger(ctxLog, () => active.info('scoped'))
runWithLogger(base, () => {
   const a: StructuredLogger | undefined = activeLogger()
   const b: StructuredLogger | undefined = activeLogger(base)
   void a; void b
})

// Express adapter + the `req.log` augmentation.
const loggingMw = makeLoggingMiddleware(logging, { als: true })
const errorMw = makeErrorMiddleware(logging)
void loggingMw; void errorMw
function expressHandler(req: ExpressRequest) {
   const reqLog: StructuredRequestLogger = req.log
   reqLog.debug('express request scoped')
}

// Next adapter + the `req.log` augmentation.
function nextMiddleware(req: NextRequest) {
   nextJSMiddleware(logging, req)
   const reqLog: StructuredRequestLogger = req.log
   reqLog.info('next request scoped')
}

// HTTP2 listeners wrap a raw Node listener and hand back a request/stream carrying `.log`.
const http2ReqListener = logging.http2RequestListener((req: Http2ServerRequestWithLog) => {
   const reqLog: StructuredRequestLogger = req.log
   reqLog.info('http2 request scoped')
})
const http2StreamListener = logging.http2StreamListener((stream: ServerHttp2StreamWithLog) => {
   const streamLog: StructuredRequestLogger = stream.log
   streamLog.info('http2 stream scoped')
})
void http2ReqListener; void http2StreamListener

const httpReq: LoggingHttpRequest = requestToHttpRequest({ method: 'GET', url: '/', headers: {} })
const entry: Partial<LogEntry> = { severity: LogSeverity.INFO }
const transport: Transport = (e: TransportLogEntry, d) => { void e; void d }
const svc: ServiceContext = { service: 'x' }
const extract: ExtractUser = () => null

void child; void httpReq; void entry; void transport; void svc; void extract; void expressHandler; void nextMiddleware
