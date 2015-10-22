'use strict';

var util = require('util');
var Consumer = require('./consumer.js');
var WorkerRoutePattern = require('./route-patterns/worker-route-pattern.js');

module.exports = Subscriber;

function Subscriber(broker, options) {
  Consumer.call(this, broker, options);

  var routeName = 'subscribe';
  if (options && options.routeName) {
    routeName = options.routeName;
  }

  var routePattern = new WorkerRoutePattern();
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
      value: [],
      enumerable: false
    }
  });

  this._broker.registerRoute(route.name, route.pattern);
}
util.inherits(Subscriber, Consumer);

Object.defineProperties(Subscriber.prototype, {
  on: {
    value: function(eventName, handler) {
      this._handlers.push({
        messageType: eventName,
        handler: handler
      });
    },
    enumerable: true
  },

  use: {
    value: function(middleware){
      this._pipeline.use(middleware);
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
      var self = this;
      //Assume all the messages coming from the queue have the same
      //serialization, all the middleware can process all the messages, and
      //they all use the same envelope. Use different queues (different routeName)
      //to setup subscribers for messages that need different handling.

      var msg = self._getDeserializedMessage(originalMessage);

      this._pipeline.prepare(function (eventSink){
        eventSink.on('ack', function(){
          self._broker.ack(self.route.name, originalMessage);
        });
        eventSink.on('nack', function(){
          self._broker.nack(self.route.name, originalMessage, false, true);
        });
        eventSink.on('reject', function(){
          self._broker.nack(self.route.name, originalMessage, false, false);
        });
        eventSink.on('error', function(){
          self._broker.nack(self.route.name, originalMessage, false, false);
        });
      })(msg)
        .then(function(){
          var data = self._getData(msg);
          var messageTypes = self._getMessageTypes(msg);
          var handlerMatches = self._getHandlerMatches(messageTypes);

          if (handlerMatches.length > 1) {
            self._broker.nack(self.route.name, originalMessage, false, false);
            return new Error('Cannot have multiple handlers for a message. If you need to do multiple things with a message, put it on multiple queues and consume it once per queue.');
          }

          if (handlerMatches.length === 1) {
            var match = handlerMatches[0];

            try {
              //Async handlers should return a promise, sync handlers shouldn't return anything
              var handlerResult = match.handler(match.messageType, data, msg.properties.authContext);

              if (handlerResult && handlerResult.then) {

                handlerResult.then(function() {
                  self._broker.ack(self.route.name, originalMessage);
                }).catch(function(err){
                  self._broker.nack(self.route.name, originalMessage, false, false);
                });

              } else {

                self._broker.ack(self.route.name, originalMessage);

              }
            } catch (err) {
              self._broker.nack(self.route.name, originalMessage, false, false);
            }
          } else {
            //A potential improvement: Wascally allows you to configure nack/reject/custom callback for unhandled messages.
            self._broker.nack(self.route.name, originalMessage, false, false);
          }
        }, function(){ /* middleware rejected the message */ });
    },
    enumerable: false
  },

  _getHandlerMatches: {
    value: function(messageTypes) {
      //Simple exact match for now

      var result = [];

      for (var i = 0; i < messageTypes.length; i++) {
        var messageType = messageTypes[i];

        for (var j = 0; j < this._handlers.length; j++) {
          var handler = this._handlers[j];

          if (handler.messageType == messageType) {
            result.push({
              messageType: messageType,
              handler: handler.handler
            });
          }
        }
      }

      return result;
    },
    enumerable: false
  }
});
