/** @typedef {import('./StructuredLogger').Request | import('express-serve-static-core').Request} Request */

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
      return /** @type {string | undefined} */(req.headers[name])
   }
}

/**
 * @param {Request} req
 * @returns {string | undefined}
 */
module.exports.getProtocol = (req) => {
   if ('http2Protocol' in req) return req.http2Protocol

   /** @type {string} */
   let proto
   if ('protocol' in req && req.protocol) {
      // Express request - this handles the x-forwarded-proto header for you
      proto = req.protocol
   } else {
      const socket = /** @type {import('node:net').Socket | import('node:tls').TLSSocket} */(req.socket)
      proto = 'encrypted' in socket && socket.encrypted ? 'https' : 'http'

      const headerProto = this.getHeader(req, 'x-forwarded-proto')
      if (headerProto) {
         // X-Forwarded-Proto should only ever a single value but just in case...
         const index = headerProto.indexOf(',')
         const p = (index !== -1 ? headerProto.substring(0, index) : headerProto).trim()
         if (p) proto = p.toLowerCase()
      }
   }

   return proto + '/' + req.httpVersion
}

/**
 * @param {Request} req
 * @returns {string | undefined}
 */
module.exports.getRemoteIp = (req) => {
   if ('ip' in req) {
      // Express request - this handles the x-forwarded header for you
      if (req.ip) return req.ip
   }
   if ('ips' in req) {
      // Express request - this handles the x-forwarded header for you
      const ip = req.ips[0]
      if (ip) return ip
   }
   // If we're in NextJS land (or IPs failed to resolve) use the forwarded header
   const headerIps = this.getHeader(req, 'x-forwarded-for')
   if (headerIps) {
      // Prevent DoS attacks for massive headers (allow at the most 64 IPs in the header)
      if (headerIps.length <= 1_024) {
         const ip = headerIps.split(/\s*,\s*/).at(-1)
         if (ip) return ip
      }
   }
}

/**
 * @param {Request} req
 * @returns {import('node:http').ServerResponse | undefined}
 */
module.exports.getResponse = (req) => {
   if ('res' in req) return req.res
}
