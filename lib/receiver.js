'use strict';

var util = require('util');
var assert = require('assert-plus');
var Consumer = require('./consumer.js');

module.exports = Receiver;

function Receiver(broker, options) {
  Consumer.call(this, broker, options);

  var routeName = 'subscribe';
  if (options && options.routeName) {
    routeName = options.routeName;
  }

  var routePattern = 'worker';
  if (options && options.routePattern) {
    routePattern = options.routePattern;
  }

  var route = {};

  Object.defineProperties(route, {
    name: {
      value: routeName,
      enumerable: true
    },
    pattern: {
      value: routePattern,
      enumerable: true
    }
  });

  Object.defineProperties(this, {
    route: {
      value: route,
      enumerable: true
    }
  });

  this._broker.registerRoute(route.name, route.pattern);
}
util.inherits(Receiver, Consumer);

Object.defineProperties(Receiver.prototype, {
  startReceiving: {
    value: function(handler) {
      assert.func(handler);

      this._handler = handler;
      var routeName = this.route.name;

      return this._broker.consume(routeName, this._consumeCallback.bind(this));
    },
    enumerable: true
  },

  _consumeCallback: {
    value: function(originalMessage) {
      var self = this;
      //Assume all the messages coming from the queue have the same
      //serialization, all the middleware can process all the messages, and
      //they all use the same envelope. Use different queues (different routeName)
      //to setup receivers for messages that need different handling.

      var msg = {
        properties: originalMessage.properties, //Should be a deep copy
        payload: self._getDeserializedPayload(originalMessage)
      };

      //TODO: add middleware execution here

      var data = self._getData(msg);
      var messageTypes = self._getMessageTypes(msg);

      //I don't think you can get here without a handler
      try {
        //Async handlers should return a promise, sync handlers shouldn't return anything
        var handlerResult = self._handler(data, messageTypes, msg.properties.authContext);

        if (handlerResult && handlerResult.then) {

          handlerResult.then(function() {
            self._broker.ack(self.route.name, originalMessage);
          }).catch(function(err) {
            self._broker.nack(self.route.name, originalMessage, false, false);
          });

        } else {

          self._broker.ack(self.route.name, originalMessage);

        }
      } catch (err) {
        self._broker.nack(self.route.name, originalMessage, false, false);
      }
    },
    enumerable: false
  }
});