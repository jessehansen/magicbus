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
 * @param {EventEmitter} events - the event emitter for unhandled error events
 * @param {Object} logger - the logger
 */
function Consumer(broker, envelope, pipeline, routeName, routePattern, logger, events) {
  assert.object(broker, 'broker');
  assert.object(envelope, 'envelope');
  assert.object(pipeline, 'pipeline');
  assert.string(routeName, 'routeName');
  assert.object(routePattern, 'routePattern');
  assert.object(logger, 'logger');
  assert.object(events, 'events');

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
            events.emit('unhandled-error', {
              data: data,
              messageTypes: messageTypes,
              message: msg,
              error: err
            });
            logger.error('Asynchronous handler failed with error, rejecting message.', err);
            actions.reject();
          });

        } else {
          actions.next();
        }
      } catch (err) {
        events.emit('unhandled-error', {
          data: data,
          messageTypes: messageTypes,
          message: msg,
          error: err
        });
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
        events.emit('unhandled-middleware-error', {
          message: originalMessage,
          error: err
        });
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
   * @param {Object} options - details in consuming from the queue
   * @param {Number} options.limit - the channel prefetch limit
   * @param {bool} options.noBatch - if true, ack/nack/reject operations will execure immediately and not be batched
   * @param {bool} options.noAck - if true, the broker won't expect an acknowledgement of messages delivered to this consumer; i.e., it will dequeue messages as soon as they've been sent down the wire. Defaults to false (i.e., you will be expected to acknowledge messages).
   * @param {String} options.consumerTag - a name which the server will use to distinguish message deliveries for the consumer; mustn't be already in use on the channel. It's usually easier to omit this, in which case the server will create a random name and supply it in the reply.
   * @param {bool} options.exclusive - if true, the broker won't let anyone else consume from this queue; if there already is a consumer, there goes your channel (so usually only useful if you've made a 'private' queue by letting the server choose its name).
   * @param {Number} options.priority - gives a priority to the consumer; higher priority consumers get messages in preference to lower priority consumers. See this RabbitMQ extension's documentation
   * @param {Object} options.arguments -  arbitrary arguments. Go to town.
   */
  const startConsuming = (messageCallback, options) => {
    assert.func(messageCallback, 'messageCallback');
    if (consuming) {
      logger.error('Attempted to start consuming on a consumer that was already active');
      assert.fail('Already consuming');
    }

    consuming = true;
    handler = messageCallback;

    logger.info('Begin consuming messages');
    return broker.consume(routeName, consumeCallback.bind(this), options);
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
