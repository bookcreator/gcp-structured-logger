import { Logging } from 'gcp-structured-logger/express'
import type { NextFunction, Request, Response } from 'express-serve-static-core'
import type { IncomingMessage } from 'node:http'

declare const req: Request
declare const res: Response
declare const next: NextFunction
declare const rawReq: IncomingMessage

interface User { id: string }
const logging = new Logging<{ user?: User }>({
   projectId: 'p',
   logName: 'l',
   serviceContext: { service: 's' },
   // The request is the Express Request plus the declared extra properties
   requestUserExtractor: request => request.user?.id ?? null,
})
const loggingMiddleware = logging.makeLoggingMiddleware()
const errorMiddleware = logging.makeErrorMiddleware()

// Only express.d.ts declares req.log. If the subpath resolved to index.d.ts
// instead, this is TS2339.
req.log.info('handling %s', req.path)
loggingMiddleware(req, res, next)
errorMiddleware(new Error('boom'), req, res, next)

// @ts-expect-error - req.log is a real StructuredRequestLogger, not any
req.log.notAMethod()
// @ts-expect-error - the Express-typed middleware does not accept a bare http request
loggingMiddleware(rawReq, res, next)
