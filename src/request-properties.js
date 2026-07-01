/** @typedef {import('./StructuredLogger').Request} Request */

/**
 * @param {Request} req
 * @returns {string}
 */
module.exports.getUrl = req => 'originalUrl' in req ? req.originalUrl : req.url

/**
 * @param {Request} req
 * @param {string} name
 * @returns {string | undefined}
 */
module.exports.getHeader = (req, name) => {
   if ('get' in req) {
      return req.get(name)
   } else {
      const r = /** @type {import('next/server').NextRequest} */ (req)
      return r.headers.has(name) ? /** @type {string} */(r.headers.get(name)) : undefined
   }
}

/**
 * @param {Request} req
 * @returns {string | undefined}
 */
module.exports.getProtocol = (req) => {
   if ('protocol' in req && req.protocol) return req.protocol + '/' + req.httpVersion
   if ('http2Protocol' in req) return req.http2Protocol
}

/**
 * @param {Request} req
 * @returns {string | undefined}
 */
module.exports.getRemoteIp = (req) => {
   if ('originalUrl' in req) {
      // Express request - this handles the x-forwarded header for you
      const ip = req.ip || (Array.isArray(req.ips) ? req.ips[0] : undefined)
      if (ip) return ip
   }
   // If we're in NextJS land (or IPs failed to resolve) use the forwarded header
   const headerIps = this.getHeader(req, 'x-forwarded-for')
   if (headerIps) {
      const ip = headerIps.split(/\s*,\s*/)[0]
      if (ip) return ip
   }
}

/**
 * @param {Request} req
 * @returns {import('express-serve-static-core').Response | undefined}
 */
module.exports.getResponse = (req) => {
   if ('res' in req && req.res) return req.res
}
