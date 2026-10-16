const { types, inspect } = require('util')

/** @type {any[]} */
const TYPES_TO_IGNORE_INSPECT_CUSTOM = [
]

/** @param {any} obj */
function canUseCustomInspect(obj) {
   if (typeof obj[inspect.custom] !== 'function') return false
   // If we've got one check we're not ignoring it
   /* c8 ignore start: no types are currently ignored */
   for (const type of TYPES_TO_IGNORE_INSPECT_CUSTOM) {
      if (obj instanceof type) return false
   }
   /* c8 ignore stop */
   return true
}

/**
 * Replaces:
 * * `Date`s with `Date#toISOString()`
 * * `Set`s with `Array`s
 * * `Buffers`s with base 64 encoded string
 * * `Map`s with `{ key: <map key>, value: <map value> }[]`
 * * `RegExp`s with `{ source: <source string>, flags: <flags string> }`
 * * Circular `object`s with `[Circular]`
 * @param {any} obj
 * @param {(parentKey: string, value: any) => any} redactor
 */
module.exports = function cleanupForJSON(obj, redactor) {
   // Use weak here so we don't capture anything
   const seenRefs = new WeakSet()

   /**
    * @param {any} _obj
    * @param {boolean} useCustomMethods
    * @returns {any}
    */
   function convert(_obj, parentKey = '', useCustomMethods = true) {
      if (Buffer.isBuffer(_obj)) return {
         '@type': 'Buffer',
         length: _obj.length,
         base64: redactor(parentKey, _obj.toString('base64')),
      }
      if (types.isRegExp(_obj)) return {
         '@type': 'RegExp',
         source: redactor(parentKey, _obj.source),
         flags: _obj.flags,
      }
      // Don't need to worry about redacting dates
      if (types.isDate(_obj)) return _obj.toISOString()
      if (typeof _obj === 'bigint') return redactor(parentKey, _obj.toString())

      if (_obj !== null && typeof _obj === 'object') {
         if (_obj instanceof Headers) {
            // Special case for Headers - the first element of each pair is the header name so means something so convert it to an object instead
            /** @type {{ [key: string]: string | string[] }} */
            const val = Object.fromEntries(_obj.entries())
            const setCookie = _obj.getSetCookie()
            if (setCookie.length > 0) val['set-cookie'] = setCookie
            return convert(val, parentKey)
         }

         if (useCustomMethods) {
            // Use the toJSON method if present as per https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#toJSON_behavior
            if (typeof _obj.toJSON === 'function') return convert(_obj.toJSON(parentKey), parentKey, false)
            // Use custom inspect method
            if (canUseCustomInspect(_obj)) return convert(_obj[inspect.custom](inspect.defaultOptions.depth, inspect.defaultOptions, inspect), parentKey, false)
         }
         // Check if we've seen this reference before
         if (seenRefs.has(_obj)) return '[Circular]'

         seenRefs.add(_obj)
         try {
            // Sets, iterables and Errors are converted to arrays/objects whose own convert call applies the redactor
            if (types.isSet(_obj)) return convert([..._obj], parentKey)
            if (types.isMap(_obj)) {
               /** @type {{ key: any, value: any }[]} */
               const val = []
               _obj.forEach((value, key) => {
                  val.push({ key: convert(key, parentKey), value: convert(value, String(key)) })
               })
               return redactor(parentKey, val)
            }
            if (Array.isArray(_obj)) return redactor(parentKey, _obj.map((v, k) => convert(v, String(k))))
            if (Symbol.iterator in _obj && typeof _obj[Symbol.iterator] === 'function') return convert([..._obj], parentKey)
            if (isError(_obj)) {
               let { name, stack, message, cause, ...props } = _obj
               // If the error name is just Error see if we've got a custom class name for it
               if (name === 'Error' && typeof _obj.constructor === 'function' && _obj.constructor.name) name = _obj.constructor.name
               // @ts-ignore
               if (name === 'AggregateError' || _obj instanceof AggregateError) props.errors = _obj.errors
               return convert({ ...props, name, stack, message, cause }, parentKey)
            }
            /** @type {[key: string, value: any][]} */
            const entries = []
            for (const k in _obj) {
               const v = _obj[k]
               // Drop functions - they're not serialisable anyway
               if (typeof v !== 'function') entries.push([k, convert(_obj[k], k)])
            }
            return redactor(parentKey, Object.fromEntries(entries))
         } finally {
            seenRefs.delete(_obj)
         }
      }
      return redactor(parentKey, _obj)
   }

   return convert(obj)
}

/**
 * @param {any} thing
 * @returns {thing is Error}
 */
function isError(thing) {
   if (typeof types.isNativeError === 'function' && types.isNativeError(thing)) return true
   // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/isError
   if (typeof Error.isError === 'function' && Error.isError(thing)) /* c8 ignore next: this can be removed once we target just Node24 */ return true
   return thing instanceof Error
}
