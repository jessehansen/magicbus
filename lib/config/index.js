'use strict';

const assert = require('assert-plus');
const _ = require('lodash');
const url = require('url');
var cutil = require('./configurator-util');

const Connection = require('../connection-machine');
const Topology = require('../topology');
const Broker = require('../broker');

const PublisherConfiguration = require('./publisher-configuration');
const Publisher = require('../publisher');

const ConsumerConfigurator = require('./consumer-configuration');
const Consumer = require('../consumer');

const SubscriberConfigurator = require('./subscriber-configuration');
const Subscriber = require('../subscriber');

const Binder = require('../binder');

/**
 * Provides logger configurability
 * @private
 * @param {Object} logger - the default logger
 */
function LoggerConfiguration(logger) {
  /**
   * Override default logger instance with the provided logger
   * @public
   * @param {Object|Function} loggerOrFactoryFunction - the logger instance or factory function
   */
  function useLogger(loggerOrFactoryFunction) {
    cutil.assertObjectOrFunction(loggerOrFactoryFunction, 'loggerOrFactoryFunction');

    if (typeof(loggerOrFactoryFunction) === 'function') {
      logger = loggerOrFactoryFunction();
    }
    else {
      logger = loggerOrFactoryFunction;
    }
  };

  /**
   * Gets the default or overridden logger
   * @public
   */
  function getParams() {
    return { logger };
  }

  return {
    /**
     * Gets the target for a configurator function to run on
     * @public
     */
    getTarget: function() {
      return { useLogger: useLogger };
    },
    getParams: getParams
  };
}

/**
 * Empty Configuration class
 * @private
 */
function NoConfiguration() {
  return {
    getTarget: () => {
      return {};
    },
    getParams: () => {
      return {};
    }
  };
}

/**
 * Common configuration functionality
 * @private
 * @param {Object} logger - the default logger
 * @param {EventEmitter} events - the event emitter for unhandled exception events
 */
module.exports = function Configurator(logger, events) {
  /**
   * Gets the parameters for the construction of the instance
   * @private
   * @param {Function} configFunc - the configuration function for the instance
   * @param {Function} configFunc - the configuration function for the instance
   */
  function getParams(configFunc, configurator) {
    assert.optionalFunc(configurator, 'configurator');
    let config = configFunc();
    let loggerConfig = LoggerConfiguration(logger);
    if (configurator) {
      let configTarget = _.assign({}, config.getTarget(), loggerConfig.getTarget());
      configurator(configTarget);
    }
    return _.assign({}, config.getParams(), loggerConfig.getParams());
  };

  /**
   * Override default logger instance for all created classes with the provided logger
   * @public
   * @param {Object|Function} loggerOrFactoryFunction - the logger instance or factory function
   */
  function useLogger(loggerOrFactoryFunction) {
    cutil.assertObjectOrFunction(loggerOrFactoryFunction, 'loggerOrFactoryFunction');

    if (typeof(loggerOrFactoryFunction) === 'function') {
      logger = loggerOrFactoryFunction();
    }
    else {
      logger = loggerOrFactoryFunction;
    }
  };

  /**
   * Create a Topology instance, for use in broker or binder
   * @public
   * @param {Object|String} connectionInfo - connection info to be passed to amqplib's connect method (required)
   * @param {String} connectionInfo.name - connection name (for logging purposes)
   * @param {String} connectionInfo.server - list of servers to connect to, separated by ','
   * @param {String} connectionInfo.port - list of ports to connect to, separated by ','. Must have the same number of entries as connectionInfo.server
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
  /* eslint-disable complexity */
  function createTopology(connectionInfo, logger) {
    let options = connectionInfo;
    if (typeof(connectionInfo) === 'string') {
      let parsed = url.parse(connectionInfo);
      options = {
        server: parsed.hostname,
        port: parsed.port || '5672',
        protocol: parsed.protocol || 'amqp://',
        user: parsed.auth && parsed.auth.indexOf(':') !== -1 ? unescape(parsed.auth.split(':')[0]) : 'guest',
        pass: parsed.auth && parsed.auth.indexOf(':') !== -1 ? unescape(parsed.auth.split(':')[1]) : 'guest',
        vhost: parsed.path && parsed.path.substring(1)
      };
    }
    let connection = Connection(options, logger.withNamespace('connection'));
    let topology = Topology(connection, logger.withNamespace('topology'));
    return topology;
  }
  /* eslint-enable complexity */

  /**
   * Create a Broker instance
   * @public
   * @param serviceDomainName {String} - your service's domain name, i.e. "integration-hub" (required)
   * @param {String} appName - your service's app name, i.e. "unit-details-api" (required)
   * @param {Object|String} connectionInfo - connection info to be passed to amqplib's connect method (required)
   * @param {String} connectionInfo.name - connection name (for logging purposes)
   * @param {String} connectionInfo.server - list of servers to connect to, separated by ','
   * @param {String} connectionInfo.port - list of ports to connect to, separated by ','. Must have the same number of entries as connectionInfo.server
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
  function createBroker(serviceDomainName, appName, connectionInfo, configurator) {
    let params = getParams(NoConfiguration, configurator);
    return Broker(serviceDomainName, appName, createTopology(connectionInfo, params.logger), params.logger);
  };

  /**
   * Creates a new {@link Binder}
   *
   * @param {Object|String} connectionInfo - connection info to be passed to amqplib's connect method (required)
   * @param {String} connectionInfo.name - connection name (for logging purposes)
   * @param {String} connectionInfo.server - list of servers to connect to, separated by ','
   * @param {String} connectionInfo.port - list of ports to connect to, separated by ','. Must have the same number of entries as connectionInfo.server
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
  function createBinder(connectionInfo, configurator) {
    let params = getParams(NoConfiguration, configurator);
    return Binder(createTopology(connectionInfo, params.logger), params.logger);
  };

  /**
   * Creates a new {@link Publisher}
   *
   * @param {Broker} broker
   * @param {publisherConfigFunction} configurator - function to customize publisher configuration (optional)
   * @returns {Publisher} a publisher
   */
  function createPublisher(broker, configurator) {
    var params = getParams(PublisherConfiguration, configurator);
    return Publisher(broker, params.envelope, params.pipeline, params.routeName, params.routePattern, params.logger);
  };

  /**
   * Creates a new {@link Consumer}
   *
   * @param {Broker} broker
   * @param {consumerConfigFunc} configurator - function to customize consumer configuration (optional)
   * @returns {Consumer} a consumer
   */
  function createConsumer(broker, configurator) {
    var params = getParams(ConsumerConfigurator, configurator);
    return Consumer(broker, params.envelope, params.pipeline, params.routeName, params.routePattern, params.logger, events);
  };

  /**
   * Creates a new {@link Subscriber}
   *
   * @param {Broker} broker
   * @param {subscriberConfigFunc} configurator - function to customize subscriber configuration (optional)
   * @param {Subscriber} a subscriber
   */
  function createSubscriber(broker, configurator) {
    var params;
    if (typeof(broker) === 'function') { //assume it's a configurator function that uses a custom consumer
      configurator = broker;
      broker = null;
    }
    params = getParams(SubscriberConfigurator, configurator);
    if (!params.consumer) {
      params.consumer = Consumer(broker, params.envelope, params.pipeline, params.routeName, params.routePattern, params.logger, events);
    }
    return Subscriber(params.consumer, params.eventDispatcher, params.logger, events);
  };

  return {
    createBroker: createBroker,
    createBinder: createBinder,
    createPublisher: createPublisher,
    createConsumer: createConsumer,
    createSubscriber: createSubscriber,
    useLogger: useLogger
  };
};

