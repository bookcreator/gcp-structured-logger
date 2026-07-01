const { constants: http2 } = require('node:http2')

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
      return /** @type {string} */(this.get(http2.HTTP2_HEADER_PATH))
   }

   get scheme() {
      return /** @type {string} */(this.get(http2.HTTP2_HEADER_SCHEME))
   }

   get method() {
      return /** @type {string} */(this.get(http2.HTTP2_HEADER_METHOD))
   }

   /**
    * @template {string} Name
    * @param {Name} name
    * @returns {Lowercase<Name> extends 'set-cookie' ? (string[] | undefined) : (string | undefined)}
    */
   get(name) {
      return /** @type {any} */(this.#headers[/** @type {string} */(name).toLowerCase()])
   }
}

module.exports = { Http2RequestHeaders }
