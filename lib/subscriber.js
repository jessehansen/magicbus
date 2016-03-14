'use strict';

var assert = require('assert-plus');

module.exports = Subscriber;

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

  this._consumer = consumer;
  this._eventDispatcher = eventDispatcher;
  this._logger = logger;
}

Subscriber.prototype._handler = function Subscriber$_handler(data, messageTypes, msg) {
  var self = this;
  this._logger.info('Subscriber received message with types ' + JSON.stringify(messageTypes) + ', handing off to event dispatcher.');
  return this._eventDispatcher.dispatch(messageTypes, data, msg)
    .catch(function (err){
      self._logger.error('Error during message dispatch', err);
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
Subscriber.prototype.on = function Subscriber$on(eventName, handler) {
  this._eventDispatcher.on(eventName, handler);
};

/**
 * Use a middleware function
 *
 * @public
 * @method
 * @param {Function} middleware - middleware to run {@see middleware.contract}
 */
Subscriber.prototype.use = function Subscriber$use(middleware) {
  this._consumer.use(middleware);
};

/**
 * Start consuming events
 *
 * @public
 * @method
 */
Subscriber.prototype.startSubscription = function Subscriber$startSubscription() {
  return this._consumer.startConsuming(this._handler.bind(this));
};

/**
 * Gets the route being used for consuming
 *
 * @public
 * @method
 * @returns {Object} details of the route
 */
Subscriber.prototype.getRoute = function Subscriber$getRoute() {
  return this._consumer.getRoute();
};

/**
 * Retrieves an open channel for this subscriber
 *
 * @public
 * @method
 * @returns {Channel} amqplib's channel
 */
Subscriber.prototype.getChannel = function() {
  return this._broker.getChannel(this._routeName);
};

/**
 * Message consumption callback
 * @callback handlerCallback
 * @memberOf Subscriber
 * @param {String} eventName - name of event
 * @param {Any} data - unpacked message data
 * @param {Object} message - raw message
 */
