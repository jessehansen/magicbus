const KINDS = ['silly', 'debug', 'verbose', 'info', 'warn', 'error']

const Logger = (namespace, eventSink) => {
  const log = (kind, message, err) => {
    let data = { namespace, kind, message }
    if (err) {
      data.err = err
    }
    eventSink.emit('log', data)
  }

  let methods = {
    withNamespace: (ns) => Logger(ns, eventSink)
  }

  for (let kind of KINDS) {
    methods[kind] = (message, err) => log(kind, message, err)
  }

  return methods
}

module.exports = Logger
