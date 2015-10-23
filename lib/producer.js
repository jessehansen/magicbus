'use strict';

var assert = require('assert-plus');
var _ = require('lodash');
var BasicEnvelope = require('./basic-envelope.js');
var ProducerPipeline = require('./middleware').ProducerPipeline;
var PublisherRoutePattern = require('./route-patterns/publisher-route-pattern');

module.exports = Producer;

function Producer(broker, options) {
  assert.object(broker, 'broker');
  assert.optionalObject(options, 'options');

  if (options) {
    assert.optionalObject(options.envelope, 'options.envelope');
    assert.optionalObject(options.pipeline, 'options.pipeline');
    assert.optionalString(options.routeName, 'options.routeName');
    assert.optionalObject(options.routePattern, 'options.routePattern');
  }

  var envelope = new BasicEnvelope();
  if (options && options.envelope) {
    assert.object(options.envelope);
    envelope = options.envelope;
  }

  var pipeline;
  if (options && options.pipeline && !Array.isArray(options.pipeline)) {
    assert.func(options.pipeline.execute);
    pipeline = options.pipeline;
  } else if (options) {
    assert.optionalArrayOfFunc(options.pipeline);
    pipeline = new ProducerPipeline(options.pipeline);
  } else {
    pipeline = new ProducerPipeline();
  }

  this._broker = broker;
  this._envelope = envelope;
  this._pipeline = pipeline;
  if (options && options.routeName) {
    this._routeName = options.routeName;
  }
  if (options && options.routePattern) {
    this._routePattern = options.routePattern;
  }
}

Producer.prototype._getMessage = function(data, kind) {
  return this._envelope.getMessage(data, kind);
};

Producer.prototype._getRoutingKey = function(data, kind) {
  return this._envelope.getRoutingKey(data, kind);
};

Producer.prototype._getSerializedContent = function(payload) {
  return this._envelope.serialize(payload);
};

Producer.prototype._getPublishOptions = function(msg, perCallPublishOptions) {
  var publishOptions = {};

  var defaults = {
    persistent: true
  };

  _.assign(publishOptions, defaults, msg.properties, perCallPublishOptions);

  return publishOptions;
};

Producer.prototype._getRouteName = function(fallbackRouteName, options){
  var routeName = fallbackRouteName;
  if (options && options.routeName) {
    routeName = options.routeName;
  }
  else if (this._routeName) {
    routeName = this._routeName;
  }

  var routePattern = new PublisherRoutePattern();
  if (options && options.routePattern) {
    routePattern = options.routePattern;
  } else if (this._routePattern) {
    routePattern = this._routePattern;
  }

  this._broker.registerRoute(routeName, routePattern);
  return routeName;
};

Producer.prototype._publish = function(message, kind, fallbackRouteName, options){
  var routeName = this._getRouteName(fallbackRouteName, options);
  var self = this;

  var msg = self._getMessage(message, kind);
  return self._pipeline.prepare()(msg).then(function(){
    var routingKey = self._getRoutingKey(message, kind);
    var content = self._getSerializedContent(msg.payload);
    var publishOptions = self._getPublishOptions(msg, (options || {}).publishOptions);

    return self._broker.publish(routeName, routingKey, content, publishOptions);
  });
};

Producer.prototype.use = function(middleware) {
  this._pipeline.use(middleware);
};

Producer.prototype.publish = function(eventName, data, options) {
  assert.string(eventName, 'eventName');
  assert.optionalObject(data, 'data');
  assert.optionalObject(options, 'options');

  return this._publish(data, eventName, 'publish', options);
};

Producer.prototype.send = function(message, messageType, options) {
  assert.object(message, 'message');
  assert.optionalString(messageType, 'messageType');
  assert.optionalObject(options, 'options');

  return this._publish(message, messageType, 'send', options);
};
