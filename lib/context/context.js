const { EventEmitter } = require('events')

const Context = (factory) => (properties = {}) => {
  const events = new EventEmitter()
  let outcome
  const impl = {
    emit: (...args) => events.emit(...args),
    outcome (requested) {
      if (requested && !outcome) {
        outcome = requested
      }
      return outcome
    }
  }

  let result = factory(impl)
  return Object.assign(result, properties)
}

module.exports = Context
