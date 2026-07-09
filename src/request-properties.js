/** @typedef {import('./types').Request} Request */

/**
 * @param {Request} req
 * @returns {string}
 */
module.exports.getUrl = (req) => req.originalUrl || req.url

/**
 * @param {Request} req
 * @param {string} name
 * @returns {string | undefined}
 */
module.exports.getHeader = (req, name) => {
   if (typeof req.get === 'function') {
      // Express-style accessor
      return req.get(name)
   }
   if (!req.headers) return undefined
   if (typeof req.headers.get === 'function') {
      // WHATWG `Headers` (Next.js / fetch)
      return req.headers.has(name) ? req.headers.get(name) : undefined
   }
   // Plain-object headers (a raw Node request); keys are already lower-cased
   const value = req.headers[name.toLowerCase()]
   return Array.isArray(value) ? value.join(', ') : value
}

/**
 * @param {Request} req
 * @returns {string | undefined}
 */
module.exports.getProtocol = (req) => {
   if ('protocol' in req && req.protocol) return `${req.protocol}/${req.httpVersion}`
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
      // Prevent DoS attacks for massive headers (allow at the most 64 IPs in the header)
      if (headerIps.length <= 1_024) {
         const ip = headerIps.split(/\s*,\s*/)[0]
         if (ip) return ip
      }
   }
}

/**
 * @param {Request} req
 * @returns {import('./types').Response | undefined}
 */
module.exports.getResponse = (req) => {
   if ('res' in req && req.res) return req.res
}
