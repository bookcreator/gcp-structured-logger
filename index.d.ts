/// <reference types="express-serve-static-core" />
import { Request, RequestHandler, ErrorRequestHandler } from 'express-serve-static-core';
import { LogSeverity } from "./src/severity";
import { StructuredLogger, StructuredRequestLogger } from './src/StructuredLogger';
import { requestToHttpRequest } from "./src/request-transformers";

export interface ServiceContext {
   service: string;
   version?: string;
}
export type ExtractUser = (req: Request) => string | null | void;
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
