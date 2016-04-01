'use strict';

const assert = require('assert-plus');
const _ = require('lodash');

/**
 * Handles general-purpose consumption of messages from the bus
 *
 * @public
 * @constructor
 * @param {Object} broker - instance of the {@link Broker} class
 * @param {Object} options
 * @param {Object} options.envelope - instance of the {@link AbstractEnvelope} class
 * @param {Object} options.pipeline - instance of the {@link Middleware.Pipeline} class
 * @param {String} options.routeName - route name (default "receive")
 * @param {Object} options.routePattern - route pattern (default {@link WorkerRoutePattern})
 * @param {Object} logger - the logger
 */
function Consumer(broker, envelope, pipeline, routeName, routePattern, logger) {
  assert.object(broker, 'broker');
  assert.object(envelope, 'envelope');
  assert.object(pipeline, 'pipeline');
  assert.string(routeName, 'routeName');
  assert.object(routePattern, 'routePattern');
  assert.object(logger, 'logger');

  let consuming = false;
  let handler = null;

  broker.registerRoute(routeName, routePattern);

  /**
   * Deserialize a message's payload by calling the envelope
   *
   * @private
   * @method
   * @memberOf Consumer.prototype
   * @param {Object} originalMessage - message to be deserialized
   * @returns {Any} deserialized payload
   */
  const getDeserializedPayload = function(originalMessage) {
    return envelope.deserialize(originalMessage.content);
  };

  /**
   * Deserialize a message
   *
   * @private
   * @method
   * @memberOf Consumer.prototype
   * @param {Object} originalMessage - message to be deserialized
   * @returns {Object} deserialized message
   */
  const getDeserializedMessage = (originalMessage) => {
    var msg = {
      properties: {},
      fields: {},
      payload: getDeserializedPayload(originalMessage)
    };

    _.assign(msg.properties, originalMessage.properties);
    _.assign(msg.fields, originalMessage.fields);

    return msg;
  };

  /**
   * Get data from a message by calling the envelope
   *
   * @private
   * @method
   * @memberOf Consumer.prototype
   * @param {Object} msg - message to retrieve data from
   * @returns {Any} data
   */
  const getData = function(msg) {
    return envelope.getData(msg);
  };

  /**
   * Get all of a message's types by calling the envelope
   *
   * @private
   * @method
   * @memberOf Consumer.prototype
   * @param {Object} msg - message to get types from
   */
  const getMessageTypes = (msg) => {
    return envelope.getMessageTypes(msg);
  };

  /**
   * Callback for message consumption
   *
   * @private
   * @method
   * @memberOf Consumer.prototype
   * @param {Object} originalMessage - message consumed from the queue
   */
  const consumeCallback = (originalMessage, ops) => {
    //Assume all the messages coming from the queue have the same
    //serialization, all the middleware can process all the messages, and
    //they all use the same envelope. Use different queues (different routeName)
    //to setup consumers for messages that need different handling.

    var messageHandled = false;

    pipeline.clone().use(function(msg, actions) {
      var data, messageTypes, handlerResult;
      logger.debug('Received message from queue');

      data = getData(msg);
      messageTypes = getMessageTypes(msg);

      //I don't think you can get here without a handler
      try {
        //Async handlers should return a promise, sync handlers shouldn't return anything
        handlerResult = handler(data, messageTypes, msg, actions);

        if (handlerResult && handlerResult.then) {
          handlerResult.then(function() {
            actions.next();
          }).catch(function(err) {
            logger.error('Asynchronous handler failed with error, rejecting message.', err);
            actions.reject();
          });

        } else {
          actions.next();
        }
      } catch (err) {
        logger.error('Synchronous handler failed with error, rejecting message.', err);
        actions.reject();
      }
    }).prepare(function(eventSink) {
      eventSink.on('ack', function() {
        logger.debug('Middleware acked message');
        messageHandled = true;
        ops.ack();
      });
      eventSink.on('nack', function() {
        logger.debug('Middleware nacked message');
        messageHandled = true;
        ops.nack();
      });

      eventSink.on('reject', function() {
        logger.debug('Middleware rejected message');
        messageHandled = true;
        ops.reject();
      });
      eventSink.on('error', function(err) {
        logger.warn('Middleware raised error, rejecting message', err);
        messageHandled = true;
        ops.reject();
      });
    })(getDeserializedMessage(originalMessage))
    .then(function() {
      if (!messageHandled) {
        ops.ack();
      }
    }).catch(function(err) {
      logger.warn('Message consumption failed.', err);
      if (!messageHandled) {
        ops.reject();
      }
    });
  };

  /**
   * Use a middleware function
   *
   * @public
   * @method
   * @memberOf Consumer.prototype
   * @param {Function} middleware - middleware to run {@see middleware.contract}
   */
  const use = (middleware) => {
    pipeline.use(middleware);
  };

  /**
   * Start consuming messages from the queue
   *
   * @public
   * @method
   * @memberOf Consumer.prototype
   * @param {Consumer.handlerCallback} messageCallback - message handler callback
   */
  const startConsuming = (messageCallback) => {
    assert.func(messageCallback, 'messageCallback');
    if (consuming) {
      logger.error('Attempted to start consuming on a consumer that was already active');
      assert.fail('Already consuming');
    }

    consuming = true;
    handler = messageCallback;

    logger.info('Begin consuming messages');
    return broker.consume(routeName, consumeCallback.bind(this));
  };

  /**
   * Purges messages from a route's queue. Useful for testing, to ensure your queue is empty before consuming
   *
   * @public
   * @method
   * @memberOf Consumer.prototype
   * @returns {Object} details of the route
   */
  const purgeQueue = () => {
    return broker.purgeRouteQueue(routeName);
  };

  /**
   * Gets the route being used for consuming
   *
   * @public
   * @method
   * @memberOf Consumer.prototype
   * @returns {Object} details of the route
   */
  const getRoute = () => {
    var brokerRoute = broker.getRouteParams();
    brokerRoute.name = routeName;
    brokerRoute.pattern = routePattern;
    return brokerRoute;
  };

  return {
    use: use,
    startConsuming: startConsuming,
    purgeQueue: purgeQueue,
    getRoute: getRoute
  };
};

/**
 * Message consumption callback
 * @callback handlerCallback
 * @memberOf Consumer
 * @param {Object} data - unpacked data
 * @param {Array} messageTypes - unpacked message types
 * @param {Object} message - raw message
 */
module.exports = Consumer;
