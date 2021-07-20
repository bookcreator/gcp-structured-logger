const { types, inspect } = require('util')

/**
 * Replaces:
 * * `Date`s with `Date#toISOString()`
 * * `Set`s with `Array`s
 * * `Buffers`s with base 64 encoded string
 * * `Map`s with `{ key: <map key>, value: <map value> }[]`
 * * `RegExp`s with `{ source: <source string>, flags: <flags string> }`
 * * Circular `object`s with `[Circular]`
 * @param {any} obj
 */
module.exports = function cleanupForJSON(obj) {
   // Use weak here so we don't capture anything
   const seenRefs = new WeakSet()

   /**
    * @param {any} _obj
    * @returns {any}
    */
   function convert(_obj, parentKey = '') {
      if (Buffer.isBuffer(_obj)) return {
         '@type': 'Buffer',
         length: _obj.length,
         base64: _obj.toString('base64')
      }
      if (types.isRegExp(_obj)) return {
         '@type': 'RegExp',
         source: _obj.source,
         flags: _obj.flags
      }
      if (types.isDate(_obj)) return _obj.toISOString()
      if (typeof _obj === 'bigint') return _obj.toString()

      if (_obj !== null && typeof _obj === 'object') {
         // Use the toJSON method if present as per https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#toJSON_behavior
         if (typeof _obj.toJSON === 'function') return convert(_obj.toJSON(parentKey), parentKey)
         // Use custom inspect method if present
         if (typeof _obj[inspect.custom] === 'function') return convert(_obj[inspect.custom](), parentKey)
         // Check if we've seen this reference before
         if (seenRefs.has(_obj)) return '[Circular]'

         seenRefs.add(_obj)
         let val
         if (types.isSet(_obj)) {
            val = convert([..._obj], parentKey)
         } else if (types.isMap(_obj)) {
            val = []
            _obj.forEach((value, key) => {
               val.push({ key: convert(key, parentKey), value: convert(value, String(key)) })
            })
         } else if (Array.isArray(_obj)) {
            val = _obj.map((v, k) => convert(v, String(k)))
         } else if (Symbol.iterator in _obj && typeof _obj[Symbol.iterator] === 'function') {
            val = convert([..._obj], parentKey)
         } else if (types.isNativeError(_obj) || _obj instanceof Error) {
            let { name, stack, message, ...props } = _obj
            // If the error name is just Error see if we've got a custom class name for it
            if (name === 'Error' && typeof _obj.constructor === 'function' && _obj.constructor.name) name = _obj.constructor.name
            val = convert({ ...props, name, stack, message }, parentKey)
         } else {
            val = {}
            for (const k in _obj) val[k] = convert(_obj[k], k)
         }
         seenRefs.delete(_obj)
         return val
      }
      return _obj
   }

   return convert(obj)
}
