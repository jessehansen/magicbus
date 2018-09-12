const assert = require('assert')
const Configurator = require('./config/config')
const Logger = require('./logger')
const EventEmitter = require('events').EventEmitter

const events = new EventEmitter()
const logger = Logger('magicbus', events)
const config = Configurator(logger, events)

const magicbus = {
  createBroker: function (serviceDomainName, appName, connectionInfo, configurator) {
    typeof serviceDomainName === 'string' ||
      assert.fail('serviceDomainName not provided, must be a string')
    typeof appName === 'string' ||
      assert.fail('appName not provided, must be a string')
    typeof connectionInfo === 'string' || (typeof connectionInfo === 'object' && connectionInfo) ||
      assert.fail('connectionInfo not provided')
    !configurator || typeof configurator === 'function' ||
      assert.fail('configurator must be a function')

    return config.createBroker(serviceDomainName, appName, connectionInfo, configurator)
  },
  createPublisher: function (broker, configurator) {
    (typeof broker === 'object' && broker) ||
      assert.fail('broker not provided')
    !configurator || typeof configurator === 'function' ||
      assert.fail('configurator must be a function')

    return config.createPublisher(broker, configurator)
  },
  createConsumer: function (broker, configurator) {
    (typeof broker === 'object' && broker) ||
      assert.fail('broker not provided')
    !configurator || typeof configurator === 'function' ||
      assert.fail('configurator must be a function')

    return config.createConsumer(broker, configurator)
  },
  createSubscriber: function (broker, configurator) {
    (typeof broker === 'object' && broker) ||
      assert.fail('broker not provided')
    !configurator || typeof configurator === 'function' ||
      assert.fail('configurator must be a function')

    return config.createSubscriber(broker, configurator)
  },
  createBinder: function (connectionInfo, configurator) {
    typeof connectionInfo === 'string' || (typeof connectionInfo === 'object' && connectionInfo) ||
      assert.fail('connectionInfo not provided')
    !configurator || typeof configurator === 'function' ||
      assert.fail('configurator must be a function')

    return config.createBinder(connectionInfo, configurator)
  },
  on: function (event, handler) {
    events.on(event, handler)
  }
}

module.exports = magicbus
