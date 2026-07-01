const { constants: http2 } = require('node:http2')

/** @type {{ [M in keyof import('node:http2').constants as M extends `HTTP2_HEADER_${string}` ? M : never]: import('node:http2').constants[M] }} */
const HEADERS = /** @type {any} */(Object.freeze(Object.fromEntries(Object.entries(http2).flatMap(([k, v]) => k.startsWith('HTTP2_HEADER_') ? [[k, v]] : []))))
const VALUES = Object.values(HEADERS)

// This just wraps HTTP2 headers so we can distinguish them from Express and NextJS requests, which have a `headers` property - otherwise IncomingHttpHeaders is just a plain object and we can't tell the difference
class Http2RequestHeaders {

   /** @readonly @type {import('node:http2').IncomingHttpHeaders} */
   #headers

   /** @param {import('node:http2').IncomingHttpHeaders} headers */
   constructor(headers) {
      this.#headers = headers
   }

   get http2Protocol() {
      return 'h2'
   }

   get url() {
      return /** @type {string} */(this.get(HEADERS.HTTP2_HEADER_PATH))
   }

   get scheme() {
      return /** @type {string} */(this.get(HEADERS.HTTP2_HEADER_SCHEME))
   }

   get method() {
      return /** @type {string} */(this.get(HEADERS.HTTP2_HEADER_METHOD))
   }

   /**
    * @template {keyof Required<import('node:http2').IncomingHttpHeaders>} Name
    * @param {Name} name
    * @returns {Lowercase<Name> extends 'set-cookie' ? (string[] | undefined) : (string | undefined)}
    */
   get(name) {
      const n = /** @type {string} */(name).toLowerCase()
      if (!VALUES.includes(n)) return
      return /** @type {any} */(this.#headers[n])
   }
}

module.exports = { Http2RequestHeaders }
