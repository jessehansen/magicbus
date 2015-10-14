'use strict';

var util = require('util');
var assert = require('assert-plus');
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
      assert.string(eventName);
      assert.optionalObject(data);
      assert.optionalObject(options, 'options');
      if (options) {
        assert.optionalString(options.routingKeyPrefix, 'options.routingKeyPrefix');
      }

      var msg = this._getMessage(data, eventName);
      //TODO: add middleware execution here

      var routeName = this.route.name;
      var routingKey = this._getRoutingKey(options, eventName);
      var content = this._getSerializedContent(msg.payload);
      var publishOptions = this._getPublishOptions(msg);
      this._broker.publish(routeName, routingKey, content, publishOptions);
    },
    enumerable: true
  }
});