'use strict';

const assert = require('assert-plus');
const Promise = require('bluebird');
const signal = require('postal').channel('rabbit.ack');

/**
 * Handles connection and channel communication with RabbitMQ
 *
 * @public
 * @constructor
 * @param {String} serviceDomainName - your service's domain name, i.e. "integration-hub"
 * @param {String} appName - your service's app name, i.e. "unit-details-api"
 * @param {Object} topology - connected rabbitmq topology
 * @param {Object} logger - the logger
 */
function Broker(serviceDomainName, appName, topology, logger) {
  assert.string(serviceDomainName, 'serviceDomainName');
  assert.string(appName, 'appName');
  assert.object(logger, 'logger');

  let routes = {};
  let closed = false;
  let ackInterval = null;

  /**
   * Registers a new route with a name and a pattern
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @param {String} name - the name of the route
   * @param {Object} pattern - the RoutePattern that defines the route's pattern
   */
  const registerRoute = (name, pattern) => {
    routes[name] = {
      pattern: pattern
    };
  };

  /**
   * Get the route pattern for the given route name
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route
   * @returns {Object} the RoutePattern for the given route name
   */
  const getRoutePattern = (routeName) => {
    return routes[routeName].pattern;
  };

  /**
   * Asserts that the broker has not been shutdown and is ready for action
   *
   * @method
   * @private
   * @memberOf Broker.prototype
   */
  const activate = () => {
    if (closed) {
      throw new Error('Broker is shut down, no more connections allowed.');
    }
    if (!ackInterval) {
      ackInterval = setInterval(function() {
        signal.publish('ack');
      }, 500);
    }
  };

  /**
   * Creates RabbitMQ queues, exchanges, and bindings for a route
   *
   * @private
   * @method
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route
   * @returns {Promise} a promise that is fulfilled with the resulting route (result has exchangeName or queueName)
   */
  const createRouteTopology = (routeName) => {
    let route = routes[routeName];

    if (route.asserted) {
      return Promise.resolve(route);
    }
    if (route.asserting) {
      return route.asserting;
    }
    activate();
    logger.debug(`Asserting route ${routeName}`);
    return route.asserting = route.pattern.createTopology(topology, serviceDomainName, appName, routeName)
      .then(function(topologyNames) {
        if (topologyNames.exchangeName) {
          route.exchangeName = topologyNames.exchangeName;
        }
        if (topologyNames.queueName) {
          route.queueName = topologyNames.queueName;
        }

        logger.debug(`Route ${routeName} asserted`);
        delete route.asserting;
        route.asserted = true;
        return route;
      }).catch(function(err){
        logger.error(`Failed to assert route ${routeName}`, err);
        return Promise.reject(err);
      });
  };

  /**
   * Gets the exchange channel for a given route
   *
   * @method
   * @private
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route the exchange is on
   * @returns {Channel} the channel
   */
  const getExchange = (routeName) => {
    activate();
    return createRouteTopology(routeName)
      .then(function(route){
        let exchangeName = route.exchangeName;
        return topology.channels['exchange:' + exchangeName];
      });
  };

  /**
   * Gets the queue channel for a given route
   *
   * @method
   * @private
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route the exchange is on
   * @returns {Channel} the channel
   */
  const getQueue = (routeName) => {
    activate();
    return createRouteTopology(routeName)
      .then(function(route){
        let queueName = route.queueName;
        return topology.channels['queue:' + queueName];
      });
  };

  /**
   * Publish a message using the given parameters
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route
   * @param {Object} message
   * @param {Buffer} message.payload - the encoded message payload
   * @param {String} message.routingKey - the message's routing key. If not specified, message.type is used
   * @param {String} message.type - an arbitrary application-specific type for the message
   * @param {String} message.contentType - a MIME type for the message content
   * @param {String} message.contentEncoding - a MIME encoding for the message content
   * @param {String} message.expiresAfter - if supplied, the message will be discarded from a queue once it's been there longer than the given number of milliseconds. In the specification this is a string; numbers supplied here will be coerced to strings for transit.
   * @param {String} message.persistent - If truthy, the message will survive broker restarts provided it's in a queue that also survives restarts.
   * @param {Object} message.headers - application specific headers to be carried along with the message content. The value as sent may be augmented by extension-specific fields if they are given in the parameters, for example, 'CC', since these are encoded as message headers; the supplied value won't be mutated
   * @param {String} message.correlationId - usually used to match replies to requests, or similar
   * @param {String} message.replyTo - often used to name a queue to which the receiving application must send replies, in an RPC scenario (many libraries assume this pattern)
   * @param {String} message.messageId - arbitrary application-specific identifier for the message. If not specified, message.id is used
   * @param {Numeric} message.timestamp - a timestamp for the message
   * @param {String} message.appId - an arbitrary identifier for the originating application
   * @returns {Promise} a promise representing the result of the publish call
   */
  const publish = (routeName, message) => {
    return getExchange(routeName).then(function(exchange) {
      logger.debug(`Publishing message to exchange ${exchange.name} with routing key ${message.routingKey}`);
      return exchange.publish(message);
    });
  };


  /**
   * Start consuming messages on the given route
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route
   * @param {Function} callback - function to be called with each message consumed
   * @returns {Promise} a promise that is fulfilled when the consume call is complete
   * @param {Object} options - details in consuming from the queue
   * @param {Number} options.limit - the channel prefetch limit
   * @param {bool} options.noBatch - if true, ack/nack/reject operations will execute immediately and not be batched
   * @param {bool} options.noAck - if true, the broker won't expect an acknowledgement of messages delivered to this consumer; i.e., it will dequeue messages as soon as they've been sent down the wire. Defaults to false (i.e., you will be expected to acknowledge messages).
   * @param {String} options.consumerTag - a name which the server will use to distinguish message deliveries for the consumer; mustn't be already in use on the channel. It's usually easier to omit this, in which case the server will create a random name and supply it in the reply.
   * @param {bool} options.exclusive - if true, the broker won't let anyone else consume from this queue; if there already is a consumer, there goes your channel (so usually only useful if you've made a 'private' queue by letting the server choose its name).
   * @param {Number} options.priority - gives a priority to the consumer; higher priority consumers get messages in preference to lower priority consumers. See this RabbitMQ extension's documentation
   * @param {Object} options.arguments -  arbitrary arguments. Go to town.
   */
  const consume = (routeName, callback, options) => {
    return getQueue(routeName).then(function(queue) {
      logger.debug('Beginning consumption from queue ' + queue.name);
      return queue.subscribe(callback, options).then(/* strip result from promise */);
    });
  };


  /**
   * Purges messages from a route's queue. Useful for testing, to ensure your queue is empty before consuming
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route
   * @returns {Promise} a promise that is fulfilled when the queue is empty
   */
  const purgeRouteQueue = (routeName) => {
    return getQueue(routeName).then(function(queue) {
      return queue.purge();
    });
  };

  /**
   * Close the connection and all associated channels
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @returns {Promise} a promise that is fulfilled when the shutdown is complete
   */
  const shutdown = () => {
    if (closed) {
      return Promise.resolve();
    }
    closed = true;
    logger.info('Shutting down broker connection');
    if (ackInterval) {
      clearInterval(ackInterval);
      ackInterval = null;
    }
    if (topology) {
      return topology.connection.close(true).then(function(){
        topology = null;
      });
    }
    return Promise.resolve();
  };


  /**
   * Gets the route params that are set by the broker
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @returns {Object} details of the route
   */
  const getRouteParams = () => {
    return {
      serviceDomainName:serviceDomainName,
      appName:appName
    };
  };

  /**
   * Checks to see if a connection is established.
   *
   * @public
   * @method
   * @memberof Broker.prototype
   * @returns {Boolean} status of the connection
   */
  const isConnected = () =>{
    return !!topology && !closed;
  };

  /**
   * Bind a publishing route to a consuming route
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @param {String} publishingRouteName - exchange route name (required)
   * @param {String} consumingRouteName - consuming route name (required)
   * @param {Object} options - binding configuration (optional)
   * @param {String} options.pattern - routing pattern (ex: "#")
   * @returns {Promise} a promise that is fulfilled when the bind is finished
   */
  const bind = (publishingRouteName, consumingRouteName, options) => {
    let exchangeName;
    let queueName;

    activate();

    return createRouteTopology(publishingRouteName)
      .then(function() {
        exchangeName = routes[publishingRouteName].exchangeName;
        return createRouteTopology(consumingRouteName);
      }).then(function() {
        queueName = routes[consumingRouteName].queueName;
        logger.info('Binding "' + exchangeName + '" to "' + queueName + '" with pattern "' + options.pattern + '"');
        return topology.createBinding({
          source: exchangeName,
          target: queueName,
          queue: true,
          keys: [options.pattern]
        });
      });
  };

  return {
    shutdown: shutdown,
    isConnected: isConnected,

    bind: bind,

    registerRoute: registerRoute,
    getRoutePattern: getRoutePattern,
    getRouteParams: getRouteParams,

    publish: publish,
    purgeRouteQueue: purgeRouteQueue,

    consume: consume
  };
}

module.exports = Broker;
