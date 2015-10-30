'use strict';

var BrokerConfigurator = require('./config/broker-configurator');
var PublisherConfigurator = require('./config/broker-configurator');
var ConsumerConfigurator = require('./config/broker-configurator');
var SubscriberConfigurator = require('./config/broker-configurator');

/**
 * @module MagicBus
 */
module.exports = {
  /**
   * Creates a new {@link Broker} with the specified configuration
   *
   * @param serviceDomainName {String} - your service's domain name, i.e. "integration-hub" (required)
   * @param {String} appName - your service's app name, i.e. "unit-details-api" (required)
   * @param {Object} connectionInfo - connection info to be passed to amqp-uri (required)
   * @param {String} connectionInfo.host - host name
   * @param {String} connectionInfo.vhost - vhost (default /)
   * @param {String} connectionInfo.user - user name (default guest)
   * @param {String} connectionInfo.pass - password (default guest)
   * @param {brokerConfigFunction} configurator - function to customize broker configuration (optional)
   * @returns {Broker} a broker
   */
  createBroker: function(serviceDomainName, appName, connectionInfo, configurator){
    return new BrokerConfigurator(serviceDomainName, appName, connectionInfo, configurator).createBroker();
  },

  /**
   * Creates a new {@link Publisher}
   *
   * @param {Broker} broker
   * @param {publisherConfigFunction} configurator - function to customize publisher configuration (optional)
   * @returns {Publisher} a publisher
   */
  createPublisher: function(broker, configurator){
    return new PublisherConfigurator(broker, configurator).createPublisher();
  },

  /**
   * Creates a new {@link Consumer}
   *
   * @param {Broker} broker
   * @param {consumerConfigFunc} configurator - function to customize consumer configuration (optional)
   * @returns {Consumer} a consumer
   */
  createConsumer: function(broker, configurator){
    return new ConsumerConfigurator(broker, configurator).createConsumer();
  },

  /**
   * Creates a new {@link Subscriber}
   *
   * @param {Broker} broker
   * @param {subscriberConfigFunc} configurator - function to customize subscriber configuration (optional)
   * @param {Subscriber} a subscriber
   */
  createSubscriber: function(broker, configurator){
    return new SubscriberConfigurator(broker, configurator).createSubscriber();
  },

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
};
