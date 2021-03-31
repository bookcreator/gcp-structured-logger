/// <reference types="express-serve-static-core" />
import { Request, RequestHandler, ErrorRequestHandler } from 'express-serve-static-core';
import { LogSeverity } from "./src/severity";
import { StructuredLogger, StructuredRequestLogger } from './src/StructuredLogger';
import { requestToHttpRequest } from "./src/request-transformers";

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
/** @see https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry */
export interface LogEntry {
   timestamp: Date;
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
export type ExtractUser = (req: Request) => string | null | void;
export type Transport = (entry: TransportLogEntry, data: string | { message?: string, [k: string]: any }) => void;
export interface LoggingConfig {
   /** GCP project ID. */
   projectId: string;
   /** Used for `log_name` label. */
   logName: string;
   /** Used for error reporting. */
   serviceContext: ServiceContext;
   /** Optional function to get a user from a request to apply to error reports. */
   requestUserExtractor?: ExtractUser;
   /** Extra labels to apply to all logs. */
   extraLabels?: {
      [labelName: string]: string;
   };
   /** Optional function to output log entries to a custom location. */
   productionTransport?: Transport;
}

export type StructuredLogger = StructuredLogger;
export type StructuredRequestLogger = StructuredRequestLogger;

export class Logging {
   constructor(config: LoggingConfig);
   readonly logger: StructuredLogger;
   makeLoggingMiddleware(): RequestHandler;
   /** This should be attached after adding the result of `makeLoggingMiddleware`. */
   makeErrorMiddleware(): ErrorRequestHandler;
   /** @returns A function to call to detach from the process. */
   attachToProcess(loggingTo: StructuredLogger): () => void;
}

// Add in support for a .log property on an Express request
declare global {
   namespace Express {
      interface Request {
         readonly log: StructuredRequestLogger;
      }
   }
}

export { requestToHttpRequest, LogSeverity };
