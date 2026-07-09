# GCP Structured Logger 
[![Node.js CI](https://github.com/bookcreator/gcp-structured-logger/workflows/Node.js%20CI/badge.svg)](https://github.com/bookcreator/gcp-structured-logger/actions?query=workflow%3A%22Node.js+CI%22)
[![npm version](https://img.shields.io/npm/v/gcp-structured-logger.svg)](https://www.npmjs.org/package/gcp-structured-logger)

Outputs [structured logs](https://cloud.google.com/run/docs/logging#writing_structured_logs) that are formatted in GCP logging.


## Basic Usage

Most basic usage it to create a `Logging` object and use the `logger` property.

```js
const { Logging, LogSeverity } = require('gcp-structured-logger')

const logging = new Logging({
   projectId: '<project-id>',
   logName: '<label for logName>', // Useful for filtering in Log viewer
   serviceContext: {
      service: '<service name>', // Name that appears in Error Reporter
      version: '<version>', // Optional version
   },
   extraLabels: { // Optional extra labels useful for more filtering
   },
   requestUserExtractor: () => {} // See below
})

logging.logger.info('Some log message', {
   extra: 'data'
}, ['Array'])
```


## Error reporting

To report errors to GCP Error Reporting the `reportError` method on a logger can be used.
An optional `severity` can also be passed in, or it is picked up from the provided error. If no `severity` is passed in `ERROR` is used.

```js
const err = new Error('An error occurred')

logging.logger.reportError(err)

// With severity
logging.logger.reportError(err, LogSeverity.ALERT)
```


## Monitoring Node Process

These get logged out to GCP Error reporting.

```js
// Listen out for uncaughtException (uses uncaughtExceptionMonitor in v12.17+) and unhandled Promise rejections
logging.attachToProcess(logging.logger)

// To remove from the process
const detachLogger = logging.attachToProcess(logging.logger)
detachLogger()
```


## With Express

Use the Express adapter from the `gcp-structured-logger/express` subpath as a logging middleware and error handler.

If the `err` has a `statusCode` or `status` property that is *less than* 500, then the severity of the err is set to `WARNING` (client errors are warnings, server errors are errors).

```js
const express = require('express')
const { makeLoggingMiddleware, makeErrorMiddleware } = require('gcp-structured-logger/express')

const app = express()

// App setup - set port, trust proxy, etc

// Add ability to use req.log in later middleware
app.use(makeLoggingMiddleware(logging))

app.use((req, res, next) => {
   req.log.debug('Incoming request')
   next()
})

// Add routes
// And a final error handler if needed
app.use((req, res, next) => next({ status: 404, message: 'Not found' }))

// Report next(err)
app.use(makeErrorMiddleware(logging))
```

Pass `{ als: true }` to run the rest of the request inside [`runWithLogger`](#active-logger-with-asynclocalstorage-opt-in), so `logging.activeLogger()` resolves to the request logger anywhere downstream:

```js
app.use(makeLoggingMiddleware(logging, { als: true }))
```

> The previous `logging.makeLoggingMiddleware()` / `logging.makeErrorMiddleware()` methods still work but are deprecated in favour of the subpath import (which keeps the core package free of an Express type dependency).


## With Node HTTP2 server

Can be use with [`node:http2`](https://nodejs.org/api/http2.html) server but only for attaching a `log` property to a `Http2ServerRequest` or `Http2Stream`.

There is no error reporting middleware for HTTP2, so you will need to call `log.reportError` yourself if you want to report errors.

```js
const http2 = require('node:http2')

const server = http2.createServer()

// With a stream
server.on('stream', logger.http2StreamListener((stream, headers) => {

   stream.log.info('Incoming request')
   stream.respond({ ':status': 200 })
   stream.end('Hello World')
}))

// Or with a request
server.on('request', logger.http2RequestListener((req, res) => {

   req.log.info('Incoming request')
   res.writeHead(200)
   res.end('Hello World')
}))
```


## With NextJS

Use the Next.js adapter from the `gcp-structured-logger/next` subpath in the [middleware file](https://nextjs.org/docs/app/building-your-application/routing/middleware#convention), ideally first (to allow you to use `req.log` in future middlewares).
This then adds the `.log` property onto all requests.

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { nextJSMiddleware } from 'gcp-structured-logger/next'

export function middleware(request: NextRequest) {
   nextJSMiddleware(logging, request);

   // Continue or do usual middleware handling
   return NextResponse.next();
}
```

> The previous `logging.nextJSMiddleware(request)` method still works but is deprecated in favour of the subpath import (which keeps the core package free of a `next` type dependency).

You can also pass in a `requestUserExtractor` function when creating a `Logging` instance for setting the [user](https://cloud.google.com/error-reporting/reference/rest/v1beta1/ErrorContext#FIELDS.user) of the error.

This is useful if you've attached the logged in user, etc. to the request or the headers contains some user info.

If `requestUserExtractor` returns no value (or is not provided), no user will be set on the reported error.

```js
const logging = new Logging({
   projectId: '<project-id>',
   logName: '<label for logName>',
   serviceContext: {
      service: '<service name>',
   },
   requestUserExtractor: req => {
      // Parameter is the request that log.reportError was called on
      return req.get('user-id')
   },
})
```


## Building a logger from a context object

`makeContextLogger` builds an enriched logger from a plain context object, so you can get the same trace correlation and Error Reporting context as `req.log` without an Express/Next request — useful for non-HTTP transports (e.g. queue workers or Slack Bolt).

```js
const { extractTraceContext, requestToErrorReportingHttpRequest } = require('gcp-structured-logger')

const log = logging.makeContextLogger({
   // A TraceContext (e.g. from extractTraceContext), or { traceId, spanId?, sampled? }
   trace: extractTraceContext(projectId, req),
   // An Error Reporting httpRequest - a value, or a function resolved when an error is reported
   httpRequest: () => requestToErrorReportingHttpRequest(req),
   // A user - a value, or a function resolved when an error is reported
   user: 'U123',
   // Extra labels for all logs from this logger
   labels: { type: 'worker' },
})

log.info('Hello')
log.reportError(new Error('Boom')) // the Error Reporting event includes httpRequest + user
```

Passing `httpRequest`/`user` as functions resolves them lazily when an error is reported, so a request's final response status code is captured.


## Active logger with AsyncLocalStorage (opt-in)

The `gcp-structured-logger/context` subpath provides an opt-in [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage) so code far from a request can log with the right trace correlation without threading a logger through every call.

```js
const { runWithLogger, activeLogger } = require('gcp-structured-logger/context')

// Run a unit of work with a logger installed as the active logger
runWithLogger(reqLog, () => {
   // ...anywhere inside, including across awaits...
   activeLogger().info('Scoped log') // resolves to reqLog

   // activeLogger(fallback) returns the fallback (or undefined) outside any scope
})
```

The `Logging` instance exposes the same pair as methods, scoped to that instance — so multiple `Logging` instances never observe one another's active logger — where `activeLogger()` falls back to the instance's base logger when called outside any scope. The Express adapter's `{ als: true }` mode uses these, so `logging.activeLogger()` resolves to the request logger downstream:

```js
const { makeLoggingMiddleware } = require('gcp-structured-logger/express')

app.use(makeLoggingMiddleware(logging, { als: true }))

// elsewhere - the request logger inside a request, the base logger outside
logging.activeLogger().info('Hello')
```

> The instance methods (`logging.runWithLogger`/`logging.activeLogger`) and the framework-free `gcp-structured-logger/context` functions are independent scopes; pick one and use it consistently.

> `AsyncLocalStorage` is opinionated and has async-boundary caveats, which is why it is a separate, opt-in import.


## With Slack Bolt

Bolt has no Express request, but Cloud Run still puts a trace header on the receiver's HTTP request. Build an enriched logger from it with `makeContextLogger` and a [global middleware](https://slack.dev/bolt-js/concepts#global-middleware), then run the handler inside it so `logging.activeLogger()` works everywhere:

```js
const { extractTraceContext, requestToErrorReportingHttpRequest } = require('gcp-structured-logger')

app.use(async ({ context, next }) => {
   const req = context.requestContext // however your receiver exposes the underlying HTTP request
   const log = logging.makeContextLogger({
      trace: extractTraceContext(projectId, req),
      httpRequest: requestToErrorReportingHttpRequest(req),
   })
   await logging.runWithLogger(log, next)
})
```
