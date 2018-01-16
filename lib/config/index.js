const url = require('url')

const Connection = require('../connection-machine')
const Topology = require('../topology')
const Broker = require('../broker')

const PublisherConfiguration = require('./publisher-configuration')
const Publisher = require('../publisher/publisher')

const ConsumerConfiguration = require('./consumer-configuration')
const Consumer = require('../consumer/consumer')

const SubscriberConfiguration = require('./subscriber-configuration')
const Subscriber = require('../subscriber')

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

const Configurator = (logger, events) => {
  const getParams = ({
    configurations,
    userConfig,
    broker
  }) => {
    let configs = configurations.map((c) => c(broker))
    configs.push(loggerConfigurator(logger))

    if (userConfig) {
      let configFunctions = Object.assign({}, ...configs.map((c) => c.getConfigurator()))
      // make chainable
      let configTarget = {}
      Object.keys(configFunctions).forEach((key) => {
        configTarget[key] = (...args) => {
          configFunctions[key](...args)
          return configTarget
        }
      })
      userConfig(configTarget)
    }
    return Object.assign({}, ...configs.map((c) => c.getParams()))
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
    let connection = Connection(options, logger.withNamespace('connection'))
    let topology = Topology(connection, logger.withNamespace('topology'))
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
  function createBroker (serviceDomainName, appName, connectionInfo, userConfig) {
    let params = getParams({ configurations: [], userConfig })
    return Broker(serviceDomainName, appName, createTopology(connectionInfo, params.logger), params.logger)
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
  function createBinder (connectionInfo, userConfig) {
    let params = getParams({ configurations: [], userConfig })
    return binderFactory(createTopology(connectionInfo, params.logger), params.logger)
  };

  /**
   * Creates a new {@link Publisher}
   *
   * @param {Broker} broker
   * @param {publisherConfigFunction} configurator - function to customize publisher configuration (optional)
   * @returns {Publisher} a publisher
   */
  function createPublisher (broker, userConfig) {
    let params = getParams({ configurations: [PublisherConfiguration], broker, userConfig })
    return Publisher({ broker, ...params })
  };

  /**
   * Creates a new {@link Consumer}
   *
   * @param {Broker} broker
   * @param {consumerConfigFunc} configurator - function to customize consumer configuration (optional)
   * @returns {Consumer} a consumer
   */
  function createConsumer (broker, userConfig) {
    let params = getParams({ configurations: [ConsumerConfiguration], broker, userConfig })
    return Consumer({ broker, events, ...params })
  };

  /**
   * Creates a new {@link Subscriber}
   *
   * @param {Broker} broker
   * @param {subscriberConfigFunc} configurator - function to customize subscriber configuration (optional)
   * @param {Subscriber} a subscriber
   */
  function createSubscriber (broker, userConfig) {
    if (typeof (broker) === 'function') { // assume it's a userConfig function that uses a custom consumer
      userConfig = broker
      broker = null
    }
    let { consumer, ...params } = getParams({
      configurations: [
        ConsumerConfiguration.withDefaultRouteName('subscribe'),
        SubscriberConfiguration
      ],
      userConfig,
      broker
    })
    if (!consumer) {
      consumer = Consumer({ broker, events, ...params })
    }
    return Subscriber({ consumer, events, ...params })
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
