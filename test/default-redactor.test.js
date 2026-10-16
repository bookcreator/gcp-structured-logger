const { inspect } = require('node:util')

const { assert } = require('chai')

const { StructuredLogger } = require('../src/StructuredLogger')
const cleanupForJSON = require('../src/cleanup-for-json')

const defaultRedact = StructuredLogger.normaliseRedactor()

const REDACTED_BY_KEY = '<redacted by key>'
const REDACTED_BY_VALUE = '<redacted by value>'

/**
 * The default redactor without the matched pattern in its output, so rewording a pattern doesn't break these tests.
 * @param {string} key
 * @param {any} value
 */
const redact = (key, value) => {
   const result = defaultRedact(key, value)
   if (typeof result === 'string' && result.startsWith('<<REDACTED> - key matches ')) return REDACTED_BY_KEY
   if (typeof result === 'string' && result.startsWith('<<REDACTED> - value matches ')) return REDACTED_BY_VALUE
   return result
}

/**
 * Titles read as `key: value → outcome (note)`, e.g. `password: null → kept (so a missing password still shows as null)`.
 * @param {string | undefined} key `undefined` for strings checked by value only
 * @param {any} value
 * @param {'redacted' | 'kept'} outcome
 * @param {string} [note]
 */
const title = (key, value, outcome, note) => `${key === undefined ? '' : `${key === '' ? '\'\'' : key}: `}${inspect(value)} → ${outcome}${note ? ` (${note})` : ''}`

/** @param {[key: string, value: any, note?: string][]} cases */
function itRedactsByKey(cases) {
   for (const [key, value, note] of cases) {

      it(title(key, value, 'redacted', note), function () {
         assert.strictEqual(redact(key, value), REDACTED_BY_KEY)
      })
   }
}

/** @param {[key: string, value: any, note?: string][]} cases */
function itKeepsUnderKey(cases) {
   for (const [key, value, note] of cases) {

      it(title(key, value, 'kept', note), function () {
         assert.strictEqual(defaultRedact(key, value), value)
      })
   }
}

// Strings checked by value use the non-sensitive key `message` so only the value can match

/** @param {[value: string, note?: string][]} cases */
function itRedactsByValue(cases) {
   for (const [value, note] of cases) {

      it(title(undefined, value, 'redacted', note), function () {
         assert.strictEqual(redact('message', value), REDACTED_BY_VALUE)
      })
   }
}

/** @param {[value: string, note?: string][]} cases */
function itKeepsValue(cases) {
   for (const [value, note] of cases) {

      it(title(undefined, value, 'kept', note), function () {
         assert.strictEqual(defaultRedact('message', value), value)
      })
   }
}

describe('Default redactor', function () {

   describe('Redacted output - names the pattern that matched', function () {

      it('should name the key pattern for a sensitive key', function () {
         assert.match(defaultRedact('password', 'hunter2'), /^<<REDACTED> - key matches \/.+\/[a-z]*>$/)
      })

      it('should name the value pattern for a credential-looking string', function () {
         assert.match(defaultRedact('message', 'password=hunter2'), /^<<REDACTED> - value matches \/.+\/[a-z]*>$/)
      })
   })

   describe('Redacted by key - the value of a sensitive key, unless it is empty or a boolean; the whole key must match, in any case', function () {

      describe('authorization, password and cookies', function () {
         itRedactsByKey([
            ['authorization', 'Bearer abc123'],
            ['Authorization', 'Basic dXNlcjpwYXNz'],
            ['password', 'hunter2'],
            ['Password', 'hunter2'],
            ['cookie', 'sid=abc123'],
            ['set-cookie', 'sid=abc123; HttpOnly'],
         ])
      })

      describe('secrets - snake_case, kebab-case or camelCase, with or without a client prefix', function () {
         itRedactsByKey([
            ['secret', 'abc123'],
            ['client_secret', 'abc123'],
            ['client-secret', 'abc123'],
            ['clientSecret', 'abc123'],
         ])
      })

      describe('API keys - with or without a separator, and as an x- header', function () {
         itRedactsByKey([
            ['api_key', 'abc123'],
            ['api-key', 'abc123'],
            ['apikey', 'abc123'],
            ['apiKey', 'abc123'],
            ['x-api-key', 'abc123'],
            ['X-API-KEY', 'abc123'],
         ])
      })

      describe('access, refresh and id tokens - snake_case, kebab-case or camelCase', function () {
         itRedactsByKey([
            ['access_token', 'abc123'],
            ['refresh-token', 'abc123'],
            ['id_token', 'abc123'],
            ['accessToken', 'abc123'],
            ['refreshToken', 'abc123'],
            ['idToken', 'abc123'],
         ])
      })

      describe('Google API key headers and private keys', function () {
         itRedactsByKey([
            ['x-goog-api-key', 'abc123'],
            ['X-Goog-Api-Key', 'abc123'],
            ['private_key', '-----BEGIN PRIVATE KEY-----\nMIIEv\n-----END PRIVATE KEY-----\n', 'e.g. in a service account key'],
            ['privateKey', 'abc123'],
            ['private-key', 'abc123'],
         ])
      })

      describe('numbers, arrays and objects are replaced whole too, not just strings', function () {
         itRedactsByKey([
            ['password', 1234],
            ['password', 0, '0 is not treated as empty'],
            ['set-cookie', ['a=1', 'b=2'], 'the whole array'],
            ['authorization', { scheme: 'Bearer', credentials: 'abc123' }, 'the whole object'],
         ])
      })

      describe('the key is checked before the value', function () {
         itRedactsByKey([
            ['password', 'Bearer abc123', 'reported as a key match'],
         ])
      })
   })

   describe('Redacted by value - credential-looking strings under any non-sensitive key, in any case; the whole string is replaced', function () {

      describe('Bearer or Basic at the start, or after "Authorization:" anywhere, then whitespace, "=" or ":"', function () {
         itRedactsByValue([
            ['Bearer abc123'],
            ['Bearer\tabc123'],
            ['Bearer\nabc123'],
            ['bearer=abc123'],
            ['bearer:abc123'],
            ['BEARER abc123'],
            ['Basic dXNlcjpwYXNz'],
            ['Authorization: Bearer abc123'],
            ['Authorization : Bearer abc123'],
            ['Proxy-Authorization: Basic dXNlcjpwYXNz'],
            ['Error: failed\nAuthorization: Bearer abc123', 'e.g. in an error stack'],
            ['GET / HTTP/1.1\r\nAuthorization: Basic dXNlcjpwYXNz\r\nCookie: sid=abc123\r\n\r\n', 'raw request headers - the other header lines go too'],
         ])
      })

      describe('a keyword at the very start, then "=" or ":"', function () {
         itRedactsByValue([
            ['password=hunter2'],
            ['Password: hunter2'],
            ['token=abc123'],
            ['TOKEN: abc123'],
            ['access_token=abc123'],
            ['refresh-token:abc123'],
            ['idtoken=abc123'],
            ['accessToken=abc123'],
            ['assertion=abc123'],
            ['Assertion: abc123'],
            ['api_key=abc123'],
            ['API-KEY: abc123'],
            ['apikey=abc123'],
            ['x-api-key=abc123'],
            ['X_API_KEY: abc123'],
            ['secret=abc123'],
            ['Secret: abc123'],
            ['client_secret=abc123'],
            ['Client-Secret:abc123'],
            ['clientSecret=abc123'],
            ['authentication=abc123'],
            ['Authentication: abc123'],
            ['authorization=abc123'],
            ['Authorization: abc123'],
         ])
      })

      describe('Google OAuth access tokens and API keys anywhere in the string - recognised by their format', function () {
         itRedactsByValue([
            ['ya29.a0AfH6SMBabc123'],
            ['token refreshed: ya29.a0AfH6SMBabc123'],
            ['AIzaSyD-abcdefghijklmnopqrstuvwxyz01234'],
            ['https://maps.googleapis.com/maps/api/geocode/json?address=x&key=AIzaSyD-abcdefghijklmnopqrstuvwxyz01234', 'Google\'s ?key= parameter'],
         ])
      })

      describe('PEM private keys of any type anywhere in the string', function () {
         itRedactsByValue([
            ['-----BEGIN PRIVATE KEY-----\nMIIEv\n-----END PRIVATE KEY-----\n'],
            ['-----BEGIN RSA PRIVATE KEY-----\nMIIEo\n-----END RSA PRIVATE KEY-----\n'],
            ['-----BEGIN EC PRIVATE KEY-----\nMHcC\n-----END EC PRIVATE KEY-----\n'],
            ['-----BEGIN OPENSSH PRIVATE KEY-----\nb3Bl\n-----END OPENSSH PRIVATE KEY-----\n'],
            ['-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIFH\n-----END ENCRYPTED PRIVATE KEY-----\n'],
            ['Invalid key: -----BEGIN PRIVATE KEY-----\nMIIEv\n-----END PRIVATE KEY-----\n', 'e.g. in an error message'],
         ])
      })

      describe('an access, refresh or id token, API key or secret parameter after "?", "&" or "#" anywhere in the string', function () {
         itRedactsByValue([
            ['https://example.com/cb?code=1&access_token=abc123', 'the whole URL is replaced, losing its host and path'],
            ['https://example.com/cb?refresh_token=abc123'],
            ['https://example.com/cb#id_token=abc123', 'OAuth implicit flow fragment'],
            ['https://example.com/?api_key=abc123'],
            ['https://example.com/#apikey=abc123'],
            ['https://example.com/?x-api-key=abc123'],
            ['https://example.com/?secret=abc123'],
            ['https://example.com/?clientSecret=abc123'],
            ['sid=abc123&access_token=xyz', 'not just URLs - any "?", "&" or "#" works'],
         ])
      })

      describe('a separator alone is enough - no credential text is needed after it', function () {
         itRedactsByValue([
            ['Bearer '],
            ['password='],
            ['secret:'],
            ['https://example.com/?access_token='],
         ])
      })

      describe('a string logged on its own has an empty key and is still checked by value', function () {

         it(title('', 'Bearer abc123', 'redacted', 'e.g. a message-only log sent to productionTransport'), function () {
            assert.strictEqual(cleanupForJSON('Bearer abc123', redact), REDACTED_BY_VALUE)
         })
      })
   })

   describe('Kept by design', function () {

      describe('empty values and booleans are never redacted, even under a sensitive key', function () {
         itKeepsUnderKey([
            ['password', ''],
            ['password', null, 'so a missing password still shows as null'],
            ['password', undefined, 'so JSON.stringify still leaves the key out'],
            ['password', true],
            ['password', false],
            ['cookie', []],
            ['cookie', {}],
         ])
      })

      describe('keys that are not sensitive themselves, even though they contain a sensitive key name', function () {
         itKeepsUnderKey([
            ['passwordHint', 'first pet'],
            ['secretary', 'Jane'],
            ['apiKeyId', 'key_123'],
            ['accessTokenExpiresAt', 1700000000],
         ])
      })

      describe('non-strings under other keys are not checked by value', function () {
         itKeepsUnderKey([
            ['count', 123],
            ['data', ['Bearer abc123'], 'an array is not searched as text - cleanupForJSON redacts its elements first'],
         ])
      })

      describe('text with no keyword', function () {
         itKeepsValue([
            ['hello world'],
         ])
      })

      describe('a keyword then a space - only Bearer and Basic accept whitespace as the separator', function () {
         itKeepsValue([
            ['Token expired for user 1'],
            ['Assertion failed: x should be 1', 'what StructuredLogger#assert() logs'],
            ['Authentication required'],
            ['Authorization denied'],
            ['Password reset email sent'],
            ['Secret Santa signup'],
            ['access_token expired for user'],
            ['api_key missing'],
            ['client_secret rotated'],
         ])
      })

      describe('a keyword with no separator after it', function () {
         itKeepsValue([
            ['Bearer'],
            ['password'],
            ['token'],
            ['secret'],
            ['Authorization'],
         ])
      })

      describe('longer words that start with a keyword - the separator must come straight after the keyword', function () {
         itKeepsValue([
            ['Bearerish abc123'],
            ['Basically: yes'],
            ['passwords=hunter2'],
            ['tokenizer=abc123'],
            ['access_tokens=abc123'],
            ['assertions=abc123'],
            ['api_keys=abc123'],
            ['secretary: Jane'],
            ['client_secrets=abc123'],
            ['authorizations=abc123'],
            ['authentications=abc123'],
         ])
      })

      describe('strings that only resemble a Google credential format', function () {
         itKeepsValue([
            ['ya29.', 'nothing after the prefix'],
            ['papaya29.5', 'ya29. must start a word'],
            ['AIzaTooShort', 'API keys are exactly 39 characters'],
         ])
      })

      describe('PEM public keys and certificates, which are not secret', function () {
         itKeepsValue([
            ['-----BEGIN PUBLIC KEY-----\nMIIBI\n-----END PUBLIC KEY-----\n'],
            ['-----BEGIN CERTIFICATE-----\nMIIDd\n-----END CERTIFICATE-----\n'],
         ])
      })
   })

   describe('Trade-offs and known gaps', function () {

      describe('accepted - ordinary messages that look like credentials are redacted', function () {
         itRedactsByValue([
            ['Basic plan selected', 'Bearer and Basic accept a space'],
            ['Bearer token missing'],
            ['Token: expired', 'other keywords need "=" or ":"'],
            ['Password: incorrect'],
         ])
      })

      describe('gap - keys not (yet) treated as sensitive, so only their values are checked', function () {
         itKeepsUnderKey([
            ['token', 'abc123', 'only access, refresh and id tokens are sensitive keys'],
            ['db_password', 'hunter2', 'the whole key must match, so prefixed or suffixed names are missed'],
            ['my_secret', 'abc123'],
            ['access_tokens', 'abc123'],
            ['x_api_key', 'abc123', 'only the hyphenated x- header prefix is recognised'],
            ['proxy-authorization', 'abc123', 'unlike authorization, only the value is checked'],
            ['x-auth-token', 'abc123'],
            ['client_assertion', 'abc123'],
            ['passwd', 'abc123'],
         ])
      })

      describe('gap - credentials not (yet) recognised in strings', function () {
         itKeepsValue([
            ['header: Bearer abc123', 'keywords only match at the very start, after "Authorization:", or as a "?", "&" or "#" parameter'],
            [' Bearer abc123', 'not after leading whitespace'],
            ['Cookie: sid=abc123', 'raw header lines other than Authorization'],
            ['X-Goog-Api-Key: abc123', 'unless the value is in the AIza… format'],
            ['my access_token=abc123', 'a space is not a parameter separator'],
            ['sid=abc123; access_token=xyz', 'nor is a cookie-style "; "'],
            ['https://example.com/?my_secret=abc123', 'a parameter name must start with the keyword'],
            ['https://example.com/?password=hunter2', 'password, token, assertion, authentication and authorization are never matched as parameters'],
            ['https://example.com/?token=abc123'],
            ['https://example.com/?access%5Ftoken=abc123', 'parameter names are not URL-decoded'],
            ['api_key abc123', 'only Bearer and Basic accept whitespace'],
            ['postgres://user:hunter2@localhost/db', 'user:password@ in a URL or connection string'],
            ['{"password":"hunter2"}', 'JSON inside a string'],
            ['Digest username="admin", response="abc123"', 'other auth schemes'],
            ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln', 'bare JWTs have no keyword'],
         ])
      })
   })

   describe('Applied to a whole log entry by cleanupForJSON', function () {

      it('should redact nested values by key or by value and keep everything else', function () {
         const entry = {
            message: 'Token expired for user 1',
            httpRequest: { requestUrl: 'https://example.com/cb?code=1&access_token=abc123', userAgent: 'curl/8.0' },
            headers: new Headers([['accept', 'text/html'], ['authorization', 'Bearer abc123'], ['set-cookie', 'a=1'], ['set-cookie', 'b=2']]),
            user: { id: 1, password: 'hunter2' },
            items: ['hello', 'Bearer abc123'],
            flags: { secret: true },
         }

         assert.deepStrictEqual(cleanupForJSON(entry, redact), {
            message: 'Token expired for user 1',
            httpRequest: { requestUrl: REDACTED_BY_VALUE, userAgent: 'curl/8.0' },
            headers: { accept: 'text/html', authorization: REDACTED_BY_KEY, 'set-cookie': REDACTED_BY_KEY },
            user: { id: 1, password: REDACTED_BY_KEY },
            items: ['hello', REDACTED_BY_VALUE],
            flags: { secret: true },
         })
      })

      it('should redact an Error message starting with a credential but keep its stack, which starts with "Error: " (known gap)', function () {
         const error = new Error('Bearer abc123')

         assert.deepStrictEqual(cleanupForJSON({ error }, redact), {
            error: { name: 'Error', message: REDACTED_BY_VALUE, stack: error.stack, cause: undefined },
         })
      })

      it('should redact both an Error message and stack containing a token parameter, as those are matched anywhere', function () {
         const error = new Error('GET https://example.com/?access_token=abc123 failed')

         assert.deepStrictEqual(cleanupForJSON({ error }, redact), {
            error: { name: 'Error', message: REDACTED_BY_VALUE, stack: REDACTED_BY_VALUE, cause: undefined },
         })
      })

      it('should redact raw request headers containing an Authorization line, e.g. on an HTTP client error', function () {
         const error = Object.assign(new Error('Request failed with status code 401'), {
            request: { _header: 'GET /v1/items HTTP/1.1\r\nAuthorization: Bearer abc123\r\nCookie: sid=abc123\r\n\r\n' },
         })

         assert.deepStrictEqual(cleanupForJSON({ error }, redact), {
            error: { name: 'Error', message: error.message, stack: error.stack, cause: undefined, request: { _header: REDACTED_BY_VALUE } },
         })
      })

      it('should redact Buffer and RegExp text under sensitive keys but keep their length and flags, and never redact Dates', function () {
         assert.deepStrictEqual(cleanupForJSON({ password: Buffer.from('abc123'), secret: /abc123/g, apiKey: new Date(0) }, redact), {
            password: { '@type': 'Buffer', length: 6, base64: REDACTED_BY_KEY },
            secret: { '@type': 'RegExp', source: REDACTED_BY_KEY, flags: 'g' },
            apiKey: '1970-01-01T00:00:00.000Z',
         })
      })
   })
})
