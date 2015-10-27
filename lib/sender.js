'use strict';

var assert = require('assert-plus');
var _ = require('lodash');
var BasicEnvelope = require('./basic-envelope.js');
var ProducerPipeline = require('./middleware').ProducerPipeline;
var PublisherRoutePattern = require('./route-patterns/publisher-route-pattern');

module.exports = Sender;

/**
 * Handles publishing of messages to the bus
 *
 * @public
 * @constructor
 * @param {Object} broker - instance of the {@link Broker} class
 * @param {Object} options
 * @param {Object} options.envelope - instance of the {@link AbstractEnvelope} class
 * @param {Object} options.pipeline - instance of the {@link Middleware.Pipeline} class
 * @param {String} options.routeName - route name (default "send" for sending, "publish" for publishing)
 * @param {Object} options.routePattern - route pattern (default {@link PublisherRoutePattern})
 */
function Sender(broker, options) {
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

Sender.prototype._getMessage = function(data, kind) {
  return this._envelope.getMessage(data, kind);
};

Sender.prototype._getRoutingKey = function(data, kind) {
  return this._envelope.getRoutingKey(data, kind);
};

Sender.prototype._getSerializedContent = function(payload) {
  return this._envelope.serialize(payload);
};

Sender.prototype._getPublishOptions = function(msg, perCallPublishOptions) {
  var publishOptions = {};

  var defaults = {
    persistent: true
  };

  _.assign(publishOptions, defaults, msg.properties, perCallPublishOptions);

  return publishOptions;
};

Sender.prototype._getRouteName = function(fallbackRouteName, options){
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

Sender.prototype._publish = function(message, kind, fallbackRouteName, options){
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

/**
 * Use a middleware function
 *
 * @public
 * @method
 * @param {Function} middleware - middleware to run {@see middleware.contract}
 */
Sender.prototype.use = function(middleware) {
  this._pipeline.use(middleware);
};

/**
 * Publish an event
 *
 * @public
 * @method
 * @param {String} eventName - name of event (required)
 * @param {Any} data - data for event (optional)
 * @param {Object} options - publishing options (optional)
 * @returns {Promise} a promise that is fulfilled when the message is published
 */
Sender.prototype.publish = function(eventName, data, options) {
  assert.string(eventName, 'eventName');
  assert.optionalObject(data, 'data');
  assert.optionalObject(options, 'options');

  return this._publish(data, eventName, 'publish', options);
};

/**
 * Publish an event
 *
 * @public
 * @method
 * @param {Any} message - message to be sent (required)
 * @param {String} messageType - message type (optional)
 * @param {Object} options - publishing options (optional)
 * @returns {Promise} a promise that is fulfilled when the message is sent
 */
Sender.prototype.send = function(message, messageType, options) {
  assert.object(message, 'message');
  assert.optionalString(messageType, 'messageType');
  assert.optionalObject(options, 'options');

  return this._publish(message, messageType, 'send', options);
};
