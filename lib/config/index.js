const url = require('url')

const connectionFactory = require('../connection-machine')
const topologyFactory = require('../topology')
const brokerFactory = require('../broker')

const publisherConfigurator = require('./publisher-configuration')
const publisherFactory = require('../publisher')

const consumerConfigurator = require('./consumer-configuration')
const consumerFactory = require('../consumer')

const subscriberConfigurator = require('./subscriber-configuration')
const subscriberFactory = require('../subscriber')

const binderFactory = require('../binder')

const loggerConfigurator = (logger) => {
  const useLogger = (aLogger) => {
    logger = aLogger
  }

  const useLoggerFactory = (factory) => {
    logger = factory()
  }

  const getParams = () => ({ logger })

  return {
    getConfigurator: () => ({
      useLogger,
      useLoggerFactory
    }),
    getParams
  }
}

function NoConfiguration () {
  return {
    getConfigurator: () => ({}),
    getParams: () => ({})
  }
}

const Configurator = (logger, events) => {
  const getParams = (configFunc, configurator) => {
    let config = configFunc()
    let loggerConfig = loggerConfigurator(logger)
    if (configurator) {
      let configFunctions = Object.assign({}, config.getConfigurator(), loggerConfig.getConfigurator())
      let configTarget = {}
      Object.keys(configFunctions).forEach((key) => {
        configTarget[key] = (...args) => {
          configFunctions[key](...args)
          return configTarget
        }
      })
      configurator(configTarget)
    }
    return Object.assign({}, config.getParams(), loggerConfig.getParams())
  }

  const useLogger = (aLogger) => {
    logger = aLogger
  }

  const useLoggerFactory = (factory) => {
    logger = factory()
  }

  /**
   * Create a Topology instance, for use in broker or binder
   * @public
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
   * @param {Object} logger - the logger to use when creating the connection & topology
   */
  function createTopology (connectionInfo, logger) {
    let options = connectionInfo
    if (typeof (connectionInfo) === 'string') {
      let parsed = url.parse(connectionInfo)
      options = {
        server: parsed.hostname,
        port: parsed.port || '5672',
        protocol: parsed.protocol,
        user: parsed.auth && parsed.auth.indexOf(':') !== -1 ? unescape(parsed.auth.split(':')[0]) : 'guest',
        pass: parsed.auth && parsed.auth.indexOf(':') !== -1 ? unescape(parsed.auth.split(':')[1]) : 'guest',
        vhost: (parsed.path && parsed.path.substring(1)) || '/'
      }
    }
    let connection = connectionFactory(options, logger.withNamespace('connection'))
    let topology = topologyFactory(connection, logger.withNamespace('topology'))
    return topology
  }

  /**
   * Create a Broker instance
   * @public
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
   * @param {baseConfigurator} configurator - optional function to customize broker dependencies
   */
  function createBroker (serviceDomainName, appName, connectionInfo, configurator) {
    let params = getParams(NoConfiguration, configurator)
    return brokerFactory(serviceDomainName, appName, createTopology(connectionInfo, params.logger), params.logger)
  };

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
  function createBinder (connectionInfo, configurator) {
    let params = getParams(NoConfiguration, configurator)
    return binderFactory(createTopology(connectionInfo, params.logger), params.logger)
  };

  /**
   * Creates a new {@link Publisher}
   *
   * @param {Broker} broker
   * @param {publisherConfigFunction} configurator - function to customize publisher configuration (optional)
   * @returns {Publisher} a publisher
   */
  function createPublisher (broker, configurator) {
    let params = getParams(publisherConfigurator, configurator)
    return publisherFactory(broker, params.envelope, params.serializer, params.pipeline, params.routeName,
      params.routePattern, params.logger)
  };

  /**
   * Creates a new {@link Consumer}
   *
   * @param {Broker} broker
   * @param {consumerConfigFunc} configurator - function to customize consumer configuration (optional)
   * @returns {Consumer} a consumer
   */
  function createConsumer (broker, configurator) {
    let params = getParams(consumerConfigurator, configurator)
    return consumerFactory(broker, params.envelope, params.serializer, params.pipeline, params.routeName,
      params.routePattern, params.logger, events)
  };

  /**
   * Creates a new {@link Subscriber}
   *
   * @param {Broker} broker
   * @param {subscriberConfigFunc} configurator - function to customize subscriber configuration (optional)
   * @param {Subscriber} a subscriber
   */
  function createSubscriber (broker, configurator) {
    let params
    if (typeof (broker) === 'function') { // assume it's a configurator function that uses a custom consumer
      configurator = broker
      broker = null
    }
    params = getParams(subscriberConfigurator, configurator)
    if (!params.consumer) {
      params.consumer = consumerFactory(broker, params.envelope, params.serializer, params.pipeline, params.routeName,
        params.routePattern, params.logger, events)
    }
    return subscriberFactory(params.consumer, params.eventDispatcher, params.logger, events)
  };

  return {
    createBroker,
    createBinder,
    createPublisher,
    createConsumer,
    createSubscriber,
    useLogger,
    useLoggerFactory
  }
}

module.exports = Configurator
