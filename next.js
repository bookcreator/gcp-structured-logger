/**
 * Next.js middleware helper: attaches a per-request logger as `req.log`.
 *
 * Call this from your [middleware file](https://nextjs.org/docs/app/building-your-application/routing/middleware#convention),
 * ideally first, so later code can use `req.log`.
 *
 * @param {import('./').Logging} logging
 * @param {import('next/server').NextRequest} req
 */
function nextJSMiddleware(logging, req) {
   Object.defineProperty(req, 'log', { value: logging._makeRequestLog(req), enumerable: true, configurable: false })
}

module.exports = { nextJSMiddleware }
