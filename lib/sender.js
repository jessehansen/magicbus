'use strict';

var util = require('util');
var assert = require('assert-plus');
var Producer = require('./producer.js');
var PublisherRoutePattern = require('./route-patterns/publisher-route-pattern.js');

module.exports = Sender;

function Sender(broker, options) {
  Producer.call(this, broker, options);

  var routeName = 'send';
  if (options && options.routeName) {
    routeName = options.routeName;
  }

  var routePattern = new PublisherRoutePattern();
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
util.inherits(Sender, Producer);

Object.defineProperties(Sender.prototype, {
  send: {
    value: function(message, messageType, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        assert.object(message);
        assert.optionalString(messageType);

        var msg = self._getMessage(message, messageType);
        
        //TODO: add middleware execution here

        var routeName = self.route.name;
        var routingKey = self._getRoutingKey(message, messageType);
        var content = self._getSerializedContent(msg.payload);
        var publishOptions = self._getPublishOptions(msg, (options || {}).publishOptions);
        resolve(self._broker.publish(routeName, routingKey, content, publishOptions));
      });
    }
  }
});