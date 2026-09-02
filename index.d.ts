import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Http2ServerRequest, Http2ServerResponse, ServerHttp2Stream, IncomingHttpHeaders, IncomingHttpStatusHeader } from 'node:http2';
import type { StructuredLogger as _StructuredLogger, StructuredTracedLogger, StructuredRequestLogger as _StructuredRequestLogger } from './src/StructuredLogger';
import { LogSeverity } from "./src/severity";
import { requestToHttpRequest } from "./src/request-transformers";
import { extractTraceContext } from "./src/trace-context";

export type StructuredLogger = _StructuredLogger;
export type StructuredRequestLogger = _StructuredRequestLogger;

/** @see https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#httprequest */
export interface LoggingHttpRequest {
   requestMethod: string;
   requestUrl: string;
   remoteIp?: string;
   referer?: string;
   userAgent?: string;
   protocol?: string;
   status?: number;
   requestSize?: number;
   responseSize?: number;
   latency?: { seconds: number, nanos?: number };
}
export interface TraceContext {
   /** Format `projects/<PROJECT-ID>/traces/<TRACE-ID>`. */
   trace: string;
   spanId: string;
   traceSampled: boolean;
}
/** @see https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry */
export interface LogEntry {
   timestamp: bigint;
   severity: LogSeverity;
   insertId?: string;
   httpRequest?: LoggingHttpRequest;
   labels?: { [k: string]: string };
   /** Format `projects/<PROJECT-ID>/traces/<TRACE-ID>`. */
   trace?: string;
   spanId?: string;
   traceSampled?: boolean;
   operation?: { id: string, producer?: string, first?: boolean, last?: boolean };
   sourceLocation?: { file?: string, line?: number | string, function?: string };
   textPayload?: string;
   jsonPayload?: any;
   protoPayload?: any;
}
export interface TransportLogEntry extends Omit<LogEntry, 'timestamp' | 'jsonPayload' | 'textPayload' | 'protoPayload'> {
   logName: string;
   timestamp: { seconds: number, nanos?: number };
}

export interface ServiceContext {
   service: string;
   version?: string;
}
export type ExtractUser<Req extends IncomingMessage> = (req: Req) => string | null | void;
export type Transport = (entry: TransportLogEntry, data: string | { message?: string, [k: string]: any }) => void;
export interface LoggingConfig<Req extends IncomingMessage = IncomingMessage> {
   /** GCP project ID. */
   projectId: string;
   /** Used for `log_name` label. */
   logName: string;
   /** Used for error reporting. */
   serviceContext: ServiceContext;
   /** Optional function to get a user from a request to apply to error reports. */
   requestUserExtractor?: ExtractUser<Req>;
   /** Extra labels to apply to all logs. */
   extraLabels?: {
      [labelName: string]: string;
   };
   /** Optional function to output log entries to a custom location. */
   productionTransport?: Transport;
}

export class Logging<Req extends IncomingMessage = IncomingMessage, Res extends ServerResponse = ServerResponse> {
   constructor(config: LoggingConfig<Req>);
   readonly logger: StructuredLogger;
   makeTracedLogger(trace: { traceId: string, spanId?: string, sampled?: boolean }): StructuredTracedLogger;
   makeLoggingMiddleware(): (req: Req, res: Res, next: () => void) => unknown;
   /** This should be attached after adding the result of `makeLoggingMiddleware`. */
   makeErrorMiddleware(): (err: any, req: Req, res: Res, next: (err: any) => void) => unknown;
   http2RequestListener(listener: (req: Http2ServerRequestWithLog, res: Http2ServerResponse) => void): (req: Http2ServerRequest, res: Http2ServerResponse) => void;
   http2StreamListener(listener: (stream: ServerHttp2StreamWithLog, headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number, rawHeaders: string[]) => void): (stream: ServerHttp2Stream, headers: IncomingHttpHeaders & IncomingHttpStatusHeader, flags: number, rawHeaders: string[]) => void;
   /** @returns A function to call to detach from the process. */
   attachToProcess(loggingTo: StructuredLogger): () => void;
}

export interface Http2ServerRequestWithLog extends Http2ServerRequest {
   readonly log: StructuredRequestLogger;
}

export interface ServerHttp2StreamWithLog extends ServerHttp2Stream {
   readonly log: StructuredRequestLogger;
}

export { requestToHttpRequest, extractTraceContext, LogSeverity };
