const assert = require('assert')
const Configurator = require('./config/config')
const Logger = require('./logger')
const EventEmitter = require('events').EventEmitter

const events = new EventEmitter()
const logger = Logger('magicbus', events)
const config = Configurator(logger, events)

/**
 * @module MagicBus
 */
const magicbus = {
  /**
   * Creates a new {@link Broker} with the specified configuration
   *
   * @param serviceDomainName {String} - your service's domain name, i.e. "integration-hub" (required)
   * @param {String} appName - your service's app name, i.e. "unit-details-api" (required)
   * @param {Object|String} connectionInfo - connection info to be passed to amqplib's connect method (required)
   * @param {String} connectionInfo.name - connection name (for logging purposes)
   * @param {String} connectionInfo.server - list of servers to connect to, separated by ','
   * @param {String} connectionInfo.port - list of ports to connect to, separated by ','. Must have the same number
        of entries as connectionInfo.server
   * @param {Number} connectionInfo.heartbeat - heartbeat timer - defaults to 30 seconds
   * @param {String} connectionInfo.protocol - connection protocol - defaults to amqp:// or amqps://
   * @param {String} connectionInfo.user - user name - defaults to guest
   * @param {String} connectionInfo.pass - password - defaults to guest
   * @param {String} connectionInfo.vhost - vhost to connect to - defaults to '/'
   * @param {String} connectionInfo.timeout - connection timeout
   * @param {String} connectionInfo.certPath - certificate file path (for SSL)
   * @param {String} connectionInfo.keyPath - key file path (for SSL)
   * @param {String} connectionInfo.caPath - certificate file path(s), separated by ',' (for SSL)
   * @param {String} connectionInfo.passphrase - certificate passphrase (for SSL)
   * @param {String} connectionInfo.pfxPath - pfx file path (for SSL)
   * @param {baseConfigurator} configurator - function to customize broker configuration (optional)
   * @returns {Broker} a broker
   */
  createBroker: function (serviceDomainName, appName, connectionInfo, configurator) {
    typeof serviceDomainName === 'string' ||
      assert.fail('serviceDomainName not provided, must be a string')
    typeof appName === 'string' ||
      assert.fail('appName not provided, must be a string')
    typeof connectionInfo === 'string' || typeof connectionInfo === 'object' ||
      assert.fail('appName not provided, must be a string')
    !configurator || typeof configurator === 'function' ||
      assert.fail('configurator must be a function')

    return config.createBroker(serviceDomainName, appName, connectionInfo, configurator)
  },

  /**
   * Creates a new {@link Publisher}
   *
   * @param {Broker} broker
   * @param {publisherConfigFunction} configurator - function to customize publisher configuration (optional)
   * @returns {Publisher} a publisher
   */
  createPublisher: function (broker, configurator) {
    typeof broker === 'object' ||
      assert.fail('broker not provided')
    !configurator || typeof configurator === 'function' ||
      assert.fail('configurator must be a function')

    return config.createPublisher(broker, configurator)
  },

  /**
   * Creates a new {@link Consumer}
   *
   * @param {Broker} broker
   * @param {consumerConfigFunc} configurator - function to customize consumer configuration (optional)
   * @returns {Consumer} a consumer
   */
  createConsumer: function (broker, configurator) {
    typeof broker === 'object' ||
      assert.fail('broker not provided')
    !configurator || typeof configurator === 'function' ||
      assert.fail('configurator must be a function')

    return config.createConsumer(broker, configurator)
  },

  /**
   * Creates a new {@link Subscriber}
   *
   * @param {Broker} broker
   * @param {subscriberConfigFunc} configurator - function to customize subscriber configuration (optional)
   * @param {Subscriber} a subscriber
   */
  createSubscriber: function (broker, configurator) {
    typeof broker === 'object' ||
      assert.fail('broker not provided')
    !configurator || typeof configurator === 'function' ||
      assert.fail('configurator must be a function')

    return config.createSubscriber(broker, configurator)
  },

  /**
   * Creates a new {@link Binder}
   *
   * @param {Object|String} connectionInfo - connection info to be passed to amqplib's connect method (required)
   * @param {String} connectionInfo.name - connection name (for logging purposes)
   * @param {String} connectionInfo.server - list of servers to connect to, separated by ','
   * @param {String} connectionInfo.port - list of ports to connect to, separated by ','. Must have the same number
        of entries as connectionInfo.server
   * @param {Number} connectionInfo.heartbeat - heartbeat timer - defaults to 30 seconds
   * @param {String} connectionInfo.protocol - connection protocol - defaults to amqp:// or amqps://
   * @param {String} connectionInfo.user - user name - defaults to guest
   * @param {String} connectionInfo.pass - password - defaults to guest
   * @param {String} connectionInfo.vhost - vhost to connect to - defaults to '/'
   * @param {String} connectionInfo.timeout - connection timeout
   * @param {String} connectionInfo.certPath - certificate file path (for SSL)
   * @param {String} connectionInfo.keyPath - key file path (for SSL)
   * @param {String} connectionInfo.caPath - certificate file path(s), separated by ',' (for SSL)
   * @param {String} connectionInfo.passphrase - certificate passphrase (for SSL)
   * @param {String} connectionInfo.pfxPath - pfx file path (for SSL)
   * @param {binderConfigFunction} configurator - function to customize binder configuration (optional)
   * @returns {Binder} a binder
   */
  createBinder: function (connectionInfo, configurator) {
    typeof connectionInfo === 'string' || typeof connectionInfo === 'object' ||
      assert.fail('appName not provided, must be a string')
    !configurator || typeof configurator === 'function' ||
      assert.fail('configurator must be a function')

    return config.createBinder(connectionInfo, configurator)
  },

  /**
   * Listens for events of type. Events include log, log:[debug,info,warn,error],
        log:[connection,queue,exchange], log:[connection,queue,exchange]:[debug,info,warn,error]
   *
   * @param {String} event - event to listen for
   * @param {Function} handler - handler to call upon event
   */
  on: function (event, handler) {
    events.on(event, handler)
  }
}

module.exports = magicbus
