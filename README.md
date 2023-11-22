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

Can be use with [`express`](http://expressjs.com) as a logging middleware and error handler.

If the `err` has a `statusCode` or `status` property that is greater or equal to 500, then the severity of the err is set to `WARNING`.

```js
const express = require('express')

const app = express()

// App setup - set port, trust proxy, etc

// Add ability to use req.log in later middleware
app.use(logger.makeLoggingMiddleware())

app.use((req, res, next) => {
   req.log.debug('Incoming request')
   next()
})

// Add routes
// And a final error handler if needed
app.use((req, res, next) => next({ status: 404, message: 'Not found' }))

// Report next(err)
app.use(logger.makeErrorMiddleware())
```


## With NextJS

Can be use Next.js in the [middleware file](https://nextjs.org/docs/app/building-your-application/routing/middleware#convention), it should be added as the first middleware (to allow you to use `req.log` in future middlewares).
This then adds the `.log` property onto all requests.

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
 
export function middleware(request: NextRequest) {
   logger.nextJSMiddleware(request);

   // Continue or do usual middleware handling
   return NextResponse.next();
}
```

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
