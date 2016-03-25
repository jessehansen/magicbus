'use strict';

const assert = require('assert-plus');
const Promise = require('bluebird');

/**
 * Handles consumption of event messages from the bus
 *
 * @public
 * @constructor
 * @param {Object} consumer - instance of the {@link Consumer} class
 * @param {Object} eventDispatcher - instance of the {@link EventDispatcher} class
 * @param {Object} logger - the logger
 */
function Subscriber(consumer, eventDispatcher, logger) {
  assert.object(consumer, 'consumer');
  assert.object(eventDispatcher, 'eventDispatcher');
  assert.object(logger, 'logger');

  /**
   * Internal message handler, passes message to event dispatcher
   *
   * @private
   * @method
   * @param {Any} data - message payload
   * @param {Array} messageTypes - message types
   * @param {Object} msg - raw message
   */
  const internalHandler = (data, messageTypes, msg) => {
    logger.info('Subscriber received message with types ' + JSON.stringify(messageTypes) + ', handing off to event dispatcher.');
    return eventDispatcher.dispatch(messageTypes, data, msg)
      .catch(function (err){
        logger.error('Error during message dispatch', err);
        return Promise.reject(err);
      })
      .then(function(executed){
        if (!executed){
          return Promise.reject(new Error('No handler registered'));
        }
        return Promise.resolve();
      });
  };

  /**
   * Subscribe to an event
   *
   * @public
   * @method
   * @param {String} eventName - name of event (required)
   * @param {Subscriber.handlerCallback} data - data for event (optional)
   */
  const on = (eventName, handler) => {
    eventDispatcher.on(eventName, handler);
  };

  /**
   * Use a middleware function
   *
   * @public
   * @method
   * @param {Function} middleware - middleware to run {@see middleware.contract}
   */
  const use = (middleware) => {
    consumer.use(middleware);
  };

  /**
   * Start consuming events
   *
   * @public
   * @method
   */
  const startSubscription = () => {
    return consumer.startConsuming(internalHandler);
  };

  /**
   * Gets the route being used for consuming
   *
   * @public
   * @method
   * @returns {Object} details of the route
   */
  const getRoute = () => {
    return consumer.getRoute();
  };

  /**
   * Purges messages from a route's queue. Useful for testing, to ensure your queue is empty before subscribing
   *
   * @public
   * @method
   * @returns {Promise} a promise that is fulfilled when the queue has been purged
   */
  const purgeQueue = () => {
    return consumer.purgeQueue();
  };

  return {
    on: on,
    use: use,
    startSubscription: startSubscription,
    getRoute: getRoute,
    purgeQueue: purgeQueue
  };
}

/**
 * Message consumption callback
 * @callback handlerCallback
 * @memberOf Subscriber
 * @param {String} eventName - name of event
 * @param {Any} data - unpacked message data
 * @param {Object} message - raw message
 */
module.exports = Subscriber;

