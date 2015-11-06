'use strict';

var assert = require('assert-plus');
var Configurator = require('./config');
var Logger = require('./logger');

var logger = new Logger();
var config = new Configurator(logger);

/**
 * @module MagicBus
 */
module.exports = {
  /**
   * Creates a new {@link Broker} with the specified configuration
   *
   * @param serviceDomainName {String} - your service's domain name, i.e. "integration-hub" (required)
   * @param {String} appName - your service's app name, i.e. "unit-details-api" (required)
   * @param {Object|String} connectionInfo - connection info to be passed to amqplib's connect method (required)
   * @param {String} connectionInfo.hostname - host name
   * @param {String} connectionInfo.vhost - vhost (default /)
   * @param {String} connectionInfo.username - user name (default guest)
   * @param {String} connectionInfo.password - password (default guest)
   * @param {brokerConfigFunction} configurator - function to customize broker configuration (optional)
   * @returns {Broker} a broker
   */
  createBroker: function(serviceDomainName, appName, connectionInfo, configurator){
    assert.string(serviceDomainName, 'serviceDomainName');
    assert.string(appName, 'appName');
    if (typeof(connectionInfo) !== 'string') {
      assert.object(connectionInfo, 'connectionInfo');
    }
    assert.optionalFunc(configurator, 'configurator');

    return config.createBroker(serviceDomainName, appName, connectionInfo, configurator);
  },

  /**
   * Creates a new {@link Publisher}
   *
   * @param {Broker} broker
   * @param {publisherConfigFunction} configurator - function to customize publisher configuration (optional)
   * @returns {Publisher} a publisher
   */
  createPublisher: function(broker, configurator){
    assert.object(broker, 'broker');
    assert.optionalFunc(configurator, 'configurator');

    return config.createPublisher(broker, configurator);
  },

  /**
   * Creates a new {@link Consumer}
   *
   * @param {Broker} broker
   * @param {consumerConfigFunc} configurator - function to customize consumer configuration (optional)
   * @returns {Consumer} a consumer
   */
  createConsumer: function(broker, configurator){
    assert.object(broker, 'broker');
    assert.optionalFunc(configurator, 'configurator');

    return config.createConsumer(broker, configurator);
  },

  /**
   * Creates a new {@link Subscriber}
   *
   * @param {Broker} broker
   * @param {subscriberConfigFunc} configurator - function to customize subscriber configuration (optional)
   * @param {Subscriber} a subscriber
   */
  createSubscriber: function(broker, configurator){
    assert.object(broker, 'broker');
    assert.optionalFunc(configurator, 'configurator');

    return config.createSubscriber(broker, configurator);
  },

  /**
   * Creates a new {@link Binder}
   *
   * @param {Object} connectionInfo - connection info to be passed to amqplib's connect method (required)
   * @param {String} connectionInfo.hostname - host name
   * @param {String} connectionInfo.vhost - vhost (default /)
   * @param {String} connectionInfo.username - user name (default guest)
   * @param {String} connectionInfo.password - password (default guest)
   * @param {binderConfigFunction} configurator - function to customize binder configuration (optional)
   * @returns {Binder} a binder
   */
  createBinder: function(connectionInfo, configurator) {
    if (typeof(connectionInfo) !== 'string') {
      assert.object(connectionInfo, 'connectionInfo');
    }
    assert.optionalFunc(configurator, 'configurator');

    return config.createBinder(connectionInfo, configurator);
  },

  logSink: logger,

  /** Exposes MagicBus' internal class implementations for further customization */
  Classes: {
    /** {@link Broker} */
    Broker: require('./broker'),
    /** {@link Binder} */
    Binder: require('./binder'),

    /** {@link Publisher} */
    Publisher: require('./publisher'),
    /** {@link Consumer} */
    Consumer: require('./consumer'),
    /** {@link Subscriber} */
    Subscriber: require('./subscriber'),

    /** {@link AbstractEnvelope} */
    AbstractEnvelope: require('./abstract-envelope'),
    /** {@link BasicEnvelope} */
    BasicEnvelope: require('./basic-envelope'),

    /** {@link JsonSerializer} */
    JsonSerializer: require('./json-serializer'),

    /** {@link RoutePatterns} */
    RoutePatterns: {
      /** {@link RoutePatterns.Publisher} */
      Publisher: require('./route-patterns/publisher-route-pattern'),
      /** {@link RoutePatterns.Worker} */
      Worker: require('./route-patterns/worker-route-pattern'),
      /** {@link RoutePatterns.Listener} */
      Listener: require('./route-patterns/listener-route-pattern')
    }
  }
};
