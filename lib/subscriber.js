'use strict';

var util = require('util');
var Consumer = require('./consumer.js');

module.exports = Subscriber;

function Subscriber(broker, options) {
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
    },

    _handlers: {
      value: {},
      enumerable: false
    }
  });

  this._broker.registerRoute(route.name, route.pattern);
}
util.inherits(Subscriber, Consumer);

Object.defineProperties(Subscriber.prototype, {
  on: {
    value: function(eventName, handler) {
      this._handlers[eventName] = handler;
    },
    enumerable: true
  },

  startSubscription: {
    value: function() {
      var routeName = this.route.name;

      return this._broker.consume(routeName, this._consumeCallback.bind(this));
    },
    enumerable: true
  },

  _consumeCallback: {
    value: function(originalMessage) {
      //Assume all the messages coming from the queue have the same
      //serialization, all the middleware can process all the messages, and
      //they all use the same envelope. Use different queues (different routeName)
      //to setup subscribers for messages that need different handling.

      var msg = {
        properties: originalMessage.properties, //Should be a deep copy so that originalMessage doesn't get mutated
        payload: this._getDeserializedPayload(originalMessage)
      };

      //TODO: add middleware execution here

      var data = this._getData(msg);
      var messageTypes = this._getMessageTypes(msg);
      var handlerMatches = this._getHandlerMatches(messageTypes);

      if (handlerMatches.length > 1) {
        //Need to do some unhandled action here. This is an unrecoverable error so don't retry.
        throw new Error('Cannot have multiple handlers for a message. If you need to do multiple things with a message, put it on multiple queues and consumer it once per queue.');
      }

      if (handlerMatches.length === 1) {
        var match = handlerMatches[0];

        try {
          //Need a way to support async handlers
          match.handler(match.messageType, data, msg.properties.authContext);

          this._broker.ack(this.route.name, originalMessage);
        } catch (err) {
          this._broker.nack(this.route.name, originalMessage, false, false);
        }
      } else {
        //Need some unhandled action here. Wascally allows you to configure nack/reject/custom callback.
      }
    },
    enumerable: false
  },

  _getHandlerMatches: {
    value: function(messageTypes) {
      //Simple exact match for now

      var result = [];

      for (var i = 0; i < messageTypes.length; i++) {
        var messageType = messageTypes[i];
        if (this._handlers[messageType]) {
          result.push({
            messageType: messageType,
            handler: this._handlers[messageType]
          });
        }
      }

      return result;
    },
    enumerable: false
  }
});