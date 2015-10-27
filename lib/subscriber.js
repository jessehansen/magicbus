'use strict';

var assert = require('assert-plus');

module.exports = Subscriber;

function Subscriber(receiver, eventDispatcher) {
  assert.object(receiver, 'receiver');
  assert.object(eventDispatcher, 'eventDispatcher');

  this._receiver = receiver;
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

Subscriber.prototype.on = function Subscriber$on(eventName, handler) {
  this._eventDispatcher.on(eventName, handler);
};

Subscriber.prototype.use = function Subscriber$use(middleware) {
  this._receiver.use(middleware);
};

Subscriber.prototype.startSubscription = function Subscriber$startSubscription() {
  return this._receiver.startConsuming(this._handler.bind(this));
};
