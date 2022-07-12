const { assert } = require('chai')
const sinon = require('sinon')
const { requestToHttpRequest, requestToErrorReportingHttpRequest } = require('../src/request-transformers')

describe('request-transformers', function () {

   /** @param {Partial<import('express-serve-static-core').Request>} obj */
   const make = (obj = { headers: {} }) => ({
      ...obj,
      get(key) {
         for (const name in this.headers) {
            if (typeof key === 'string' && key.toLowerCase() === name.toLowerCase()) {
               return this.headers[name]
            }
         }
      }
   })

   describe('.httpRequest', function () {
      const url = 'https://url.com'
      const method = 'GET'
      const httpVersion = '1.0'
      const base = {
         originalUrl: url,
         method,
         httpVersion,
      }

      it('should include basic properties', function () {
         const req = make({
            ...base
         })
         assert.deepStrictEqual(requestToHttpRequest(req), {
            requestUrl: url,
            requestMethod: method,
         })
      })
      it('should include remoteIp derived from req.ip', function () {
         const req = make({
            ...base,
            ip: '127.0.0.1'
         })
         assert.deepStrictEqual(requestToHttpRequest(req), {
            requestUrl: url,
            requestMethod: method,
            remoteIp: '127.0.0.1',
         })
      })
      it('should include userAgent derived from user-agent header', function () {
         const req = make({
            ...base,
            headers: {
               'user-agent': 'UA'
            }
         })
         assert.deepStrictEqual(requestToHttpRequest(req), {
            requestUrl: url,
            requestMethod: method,
            userAgent: 'UA',
         })
      })
      it('should include referer derived from referrer header', function () {
         const req = make({
            ...base,
            headers: {
               'referrer': 'https://google.com'
            }
         })
         assert.deepStrictEqual(requestToHttpRequest(req), {
            requestUrl: url,
            requestMethod: method,
            referer: 'https://google.com',
         })
      })
      it('should include requestSize derived from content-length header', function () {
         const req = make({
            ...base,
            headers: {
               'content-length': '123'
            }
         })
         assert.deepStrictEqual(requestToHttpRequest(req), {
            requestUrl: url,
            requestMethod: method,
            requestSize: 123,
         })
      })
      it('should include HTTP version in protocol base on the requests protocol', function () {
         const req = make({
            ...base,
            protocol: 'https'
         })
         assert.deepStrictEqual(requestToHttpRequest(req), {
            requestUrl: url,
            requestMethod: method,
            protocol: `https/${httpVersion}`,
         })
      })
      it('should include status from req.res', function () {
         const req = make({
            ...base,
            res: make({ statusCode: 200 })
         })
         assert.deepStrictEqual(requestToHttpRequest(req), {
            requestUrl: url,
            requestMethod: method,
            status: 200,
         })
      })
      it('should include responseSize from req.res', function () {
         const req = make({
            ...base,
            res: make({
               statusCode: 202,
               headers: {
                  'content-length': 567
               }
            })
         })
         assert.deepStrictEqual(requestToHttpRequest(req), {
            requestUrl: url,
            requestMethod: method,
            status: 202,
            responseSize: 567,
         })
      })
   })

   describe('.errorReportingHttpRequest', function () {
      const url = 'https://url.com'
      const method = 'GET'
      const base = {
         originalUrl: url,
         method,
      }

      it('should include basic properties', function () {
         const req = make({
            ...base
         })
         assert.deepStrictEqual(requestToErrorReportingHttpRequest(req), {
            url,
            method,
         })
      })
      it('should include remoteIp derived from req.ip', function () {
         const req = make({
            ...base,
            ip: '127.0.0.1'
         })
         assert.deepStrictEqual(requestToErrorReportingHttpRequest(req), {
            url,
            method,
            remoteIp: '127.0.0.1',
         })
      })
      it('should include remoteIp derived from req.ips', function () {
         const req = make({
            ...base,
            ips: ['127.0.0.1']
         })
         assert.deepStrictEqual(requestToErrorReportingHttpRequest(req), {
            url,
            method,
            remoteIp: '127.0.0.1',
         })
      })
      it('should include remoteIp derived from x-forwarded-for header', function () {
         const req = make({
            ...base,
            headers: {
               'x-forwarded-for': '127.0.0.1'
            }
         })
         assert.deepStrictEqual(requestToErrorReportingHttpRequest(req), {
            url,
            method,
            remoteIp: '127.0.0.1',
         })
      })
      it('should include remoteIp derived from x-forwarded-for headers', function () {
         const req = make({
            ...base,
            headers: {
               'x-forwarded-for': ['127.0.0.1']
            }
         })
         assert.deepStrictEqual(requestToErrorReportingHttpRequest(req), {
            url,
            method,
            remoteIp: '127.0.0.1',
         })
      })
      it('should not include remoteIp derived from x-forwarded-for headers', function () {
         const req = make({
            ...base,
            headers: {
               'x-forwarded-for': []
            }
         })
         assert.deepStrictEqual(requestToErrorReportingHttpRequest(req), {
            url,
            method,
         })
      })
      it('should include userAgent derived from user-agent header', function () {
         const req = make({
            ...base,
            headers: {
               'user-agent': 'UA'
            }
         })
         assert.deepStrictEqual(requestToErrorReportingHttpRequest(req), {
            url,
            method,
            userAgent: 'UA',
         })
      })
      it('should include referrer derived from referrer header', function () {
         const req = make({
            ...base,
            headers: {
               'referrer': 'https://google.com'
            }
         })
         assert.deepStrictEqual(requestToErrorReportingHttpRequest(req), {
            url,
            method,
            referrer: 'https://google.com',
         })
      })
      it('should include responseStatusCode from req.res', function () {
         const req = make({
            ...base,
            res: make({ statusCode: 201 })
         })
         assert.deepStrictEqual(requestToErrorReportingHttpRequest(req), {
            url,
            method,
            responseStatusCode: 201,
         })
      })
   })
})
