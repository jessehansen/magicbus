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
 */
function Subscriber(consumer, eventDispatcher) {
  assert.object(consumer, 'consumer');
  assert.object(eventDispatcher, 'eventDispatcher');

  this._consumer = consumer;
  this._eventDispatcher = eventDispatcher;
}

Subscriber.prototype._handler = function Subscriber$_handler(data, messageTypes, msg) {
  return this._eventDispatcher.dispatch(messageTypes, data, msg).then(function(executed){
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

Subscriber.prototype.getRoute = function Subscriber$getRoute() {
  return this._receiver.getRoute();
};

/**
 * Message consumption callback
 * @callback handlerCallback
 * @memberOf Subscriber
 * @param {String} eventName - name of event
 * @param {Any} data - unpacked message data
 * @param {Object} message - raw message
 */
