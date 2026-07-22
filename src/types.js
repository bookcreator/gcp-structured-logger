/**
 * Shared type definitions used across the logger.
 *
 * These are JSDoc `@typedef`s with no runtime representation; the empty
 * `module.exports` keeps this a real module so the types can be imported via
 * `import('./types').TypeName` and emitted into the generated declarations.
 */

/**
 * @see https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#httprequest
 * @typedef {object} LoggingHttpRequest
 * @prop {string} requestMethod
 * @prop {string} requestUrl
 * @prop {string} [remoteIp]
 * @prop {string} [referer]
 * @prop {string} [userAgent]
 * @prop {string} [protocol]
 * @prop {number} [status]
 * @prop {number} [requestSize]
 * @prop {number} [responseSize]
 * @prop {{ seconds: number, nanos?: number }} [latency]
 */

/**
 * @typedef {object} TraceContext
 * @prop {string} trace Format `projects/<PROJECT-ID>/traces/<TRACE-ID>`.
 * @prop {string} spanId
 * @prop {boolean} traceSampled
 */

/**
 * @see https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry
 * @typedef {object} LogEntry
 * @prop {bigint} timestamp
 * @prop {import('./severity').LogSeverity} severity
 * @prop {string} [insertId]
 * @prop {LoggingHttpRequest} [httpRequest]
 * @prop {{ [k: string]: string }} [labels]
 * @prop {string} [trace] Format `projects/<PROJECT-ID>/traces/<TRACE-ID>`.
 * @prop {string} [spanId]
 * @prop {boolean} [traceSampled]
 * @prop {{ id: string, producer?: string, first?: boolean, last?: boolean }} [operation]
 * @prop {{ file?: string, line?: number | string, function?: string }} [sourceLocation]
 * @prop {string} [textPayload]
 * @prop {any} [jsonPayload]
 * @prop {any} [protoPayload]
 */

/**
 * @typedef {Omit<LogEntry, 'timestamp' | 'jsonPayload' | 'textPayload' | 'protoPayload'> & {
 *    logName: string,
 *    timestamp: { seconds: number, nanos?: number },
 * }} TransportLogEntry
 */

/**
 * @typedef {object} ServiceContext
 * @prop {string} service
 * @prop {string} [version]
 */

/**
 * Optional function to get a user from a request to apply to error reports.
 *
 * Declaring the signature as an object *method* and indexing it back out (the "bivariance hack",
 * as used in React's types) makes the request parameter *bivariant*: callers can type it as their
 * framework's request (Express `Request`, Next.js `NextRequest`, …) without a `strictFunctionTypes`
 * error, while an unannotated callback still gets the structural `Request` type — all without the
 * root package depending on framework types. A plain `(req: Request) => …` would reject the
 * framework-typed callbacks (contravariant parameters); `any` would accept them but throw away the
 * structural typing.
 * @typedef {{ extractUser(req: Request): string | null | void }['extractUser']} ExtractUser
 */

/**
 * Optional function to output log entries to a custom location.
 * @typedef {(entry: TransportLogEntry, data: string | { message?: string, [k: string]: any }) => void} Transport
 */

/**
 * @typedef {object} LoggingConfigBase
 * @prop {string} projectId GCP project ID.
 * @prop {string} logName Used for `log_name` label.
 * @prop {ServiceContext} serviceContext Used for error reporting.
 * @prop {{ [labelName: string]: string }} [extraLabels] Extra labels to apply to all logs.
 * @prop {Transport} [productionTransport] Optional function to output log entries to a custom location.
 */

/**
 * `requestUserExtractor` is intersected in (rather than declared as a `@prop`) so the emitted
 * declaration keeps *referencing* the bivariant `ExtractUser` type. A `@prop {ExtractUser}` would
 * inline it to a plain `(req: Request) => …`, which reintroduces the contravariant-parameter
 * rejection of framework-typed callbacks that `ExtractUser`'s bivariance is designed to avoid.
 * @typedef {LoggingConfigBase & { requestUserExtractor?: ExtractUser }} LoggingConfig
 */

/**
 * Structural shape of the request objects this library reads — an Express
 * `Request`, a Next.js `NextRequest`, a raw Node request, or the HTTP2 header
 * wrapper (`Http2RequestHeaders`) passed by the HTTP2 listeners. Kept
 * framework-agnostic so the core never depends on `express` or `next` types;
 * the concrete framework types live in the `gcp-structured-logger/express` and
 * `gcp-structured-logger/next` entry points.
 *
 * `http2Protocol` and `headers` are optional because the HTTP2 wrapper exposes
 * `method`/`url`/`get`/`http2Protocol` but deliberately has no `headers` property
 * (that absence is how the helpers tell it apart from Express/Next requests).
 *
 * @typedef {object} Request
 * @prop {string} method
 * @prop {string} url
 * @prop {string} [originalUrl]
 * @prop {string} [httpVersion]
 * @prop {string} [protocol]
 * @prop {string} [http2Protocol]
 * @prop {string} [ip]
 * @prop {readonly string[]} [ips]
 * @prop {Response} [res]
 * @prop {(name: string) => any} [get]
 * @prop {any} [headers]
 */

/**
 * Structural shape of the response object attached to an Express request.
 * @typedef {object} Response
 * @prop {number} statusCode
 * @prop {(name: string) => any} get
 */

module.exports = {}
