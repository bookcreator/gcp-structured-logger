// eslint-disable-next-line n/no-missing-import
import type { Request } from 'express-serve-static-core'
import type { NextRequest as _NextRequest } from 'next/server'
import { StructuredRequestLogger } from './src/StructuredLogger'
import type { ServiceContext, Entry } from '@google-cloud/logging'

export { ServiceContext }

type LogEntry = Omit<Entry['metadata'], 'timestamp'> & { timestamp: Date }
type LogSeverity = LogEntry['severity']
export { LogEntry, LogSeverity }

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

export type ExtractUser = (req: Request | _NextRequest) => string | null | void;
export type Transport = (entry: TransportLogEntry, data: string | { message?: string, [k: string]: unknown }) => void;

export interface TransportLogEntry extends Omit<LogEntry, 'timestamp' | 'jsonPayload' | 'textPayload' | 'protoPayload'> {
  logName: string;
  timestamp: { seconds: number, nanos?: number };
}

declare global {
  namespace Express {
    interface Request {
      readonly log: StructuredRequestLogger;
    }
  }

  interface NextRequest extends _NextRequest {
    readonly log: StructuredRequestLogger;
  }
}
