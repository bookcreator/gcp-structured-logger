const { AsyncLocalStorage } = require('async_hooks')

/**
 * Creates an isolated active-logger scope, backed by its own `AsyncLocalStorage`. Each scope is
 * independent, so separate `Logging` instances never observe one another's active logger.
 */
function createLoggerContext() {
   /** @type {AsyncLocalStorage<import('./StructuredLogger').StructuredLogger>} */
   const storage = new AsyncLocalStorage()

   /**
    * Runs `fn` with `logger` installed as the active logger for the duration of the call (and any
    * async work it awaits), retrievable via {@link activeLogger}.
    * @template T
    * @param {import('./StructuredLogger').StructuredLogger} logger
    * @param {() => T} fn
    * @returns {T}
    */
   function runWithLogger(logger, fn) {
      return storage.run(logger, fn)
   }

   /**
    * Returns the logger installed by the nearest enclosing {@link runWithLogger}, or `fallback`
    * when called outside any scope.
    * @param {import('./StructuredLogger').StructuredLogger} [fallback]
    * @returns {import('./StructuredLogger').StructuredLogger | undefined}
    */
   function activeLogger(fallback) {
      return storage.getStore() ?? fallback
   }

   return { runWithLogger, activeLogger }
}

/**
 * Opt-in, framework-free active-logger scope, exposed via `gcp-structured-logger/context`. Lets
 * code far from a request log with the right trace correlation without threading a logger through
 * every call.
 */
const { runWithLogger, activeLogger } = createLoggerContext()

module.exports = { createLoggerContext, runWithLogger, activeLogger }
