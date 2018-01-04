const EventEmitter = require('events').EventEmitter

const KINDS = ['silly', 'debug', 'verbose', 'info', 'warn', 'error']

/**
 * Create a new logger
 * @param {String} namespace - optional namespace for the logs
 * @param {EventEmitter} eventSink - optional EventEmitter for the log events to be emitted upon. If omitted,
      a new EventEmitter will be created
 */
function Logger (namespace, eventSink) {
  if (namespace && typeof (namespace) !== 'string') {
    throw new Error('Logger namespace must be a string')
  }
  let sink = eventSink || new EventEmitter()

  /**
   * log a message
   * @param {String} kind - the log level - (silly, debug, verbose, info, warn, error)
   * @param {String} message - log message
   * @param {EventEmitter} eventSink - optional EventEmitter for the log events to be emitted upon. If omitted,
        a new EventEmitter will be created
   */
  const log = (kind, message, err) => {
    let data = { kind: kind, message: message }
    if (err) {
      data.err = err
    }
    if (namespace) {
      data.namespace = namespace
    }
    sink.emit('log', data)
  }

  /**
   * create a new logger with the specified namespace
   * @param {String} ns - the namespace to add
   * @param {String|bool} separator - string to separate chained namespaces. Pass boolean false if new beginning
        namespace is desired
   * @returns {Logger} a new logger with the specified namespace
   */
  const withNamespace = (ns, separator) => {
    let result = (separator !== false && namespace) ? [namespace, ns] : [ns]
    return Logger(result.join(separator || '.'), sink)
  }

  let methods = { on: sink.on.bind(sink), withNamespace: withNamespace }

  for (let kind of KINDS) {
    methods[kind] = (message, err) => log(kind, message, err)
  }

  return methods
};

module.exports = Logger
