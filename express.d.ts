/// <reference types="express-serve-static-core" preserve="true" />
import type { Request, Response } from 'express-serve-static-core';
import type { Logging as _Logging, StructuredRequestLogger } from './';

// This only needs to export types as the backing functionality is the same
// Also allow defined properties to be accessed if needed
export class Logging<ReqProps = {}> extends _Logging<Readonly<Request & ReqProps>, Response> { }

// Add in support for a .log property on an Express request
declare global {
   namespace Express {
      interface Request {
         readonly log: StructuredRequestLogger;
      }
   }
}
