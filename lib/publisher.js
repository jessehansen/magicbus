'use strict';

var util = require('util');
var assert = require('assert-plus');
var Promise = require('bluebird');
var Producer = require('./producer.js');

module.exports = Publisher;

function Publisher(broker, options) {
  Producer.call(this, broker, options);

  var routeName = 'publish';
  if (options && options.routeName) {
    routeName = options.routeName;
  }

  var routePattern = 'topic-publisher';
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
util.inherits(Publisher, Producer);

Object.defineProperties(Publisher.prototype, {
  publish: {
    value: function(eventName, data, options) {
      var self = this;
      return new Promise(function(resolve, reject) {
        assert.string(eventName);
        assert.optionalObject(data);
        assert.optionalObject(options, 'options');
        if (options) {
          assert.optionalString(options.routingKeyPrefix, 'options.routingKeyPrefix');
        }

        var msg = self._getMessage(data, eventName);
        //TODO: add middleware execution here

        var routeName = self.route.name;
        var routingKey = self._getRoutingKey(options, eventName);
        var content = self._getSerializedContent(msg.payload);
        var publishOptions = self._getPublishOptions(msg);
        resolve(self._broker.publish(routeName, routingKey, content, publishOptions));
      });
    },
    enumerable: true
  }
});