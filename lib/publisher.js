'use strict';

var assert = require('assert-plus');
var _ = require('lodash');

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
 * @param {Object} logger - the logger
 */
function Publisher(broker, envelope, pipeline, routeName, routePattern, logger) {
  assert.object(broker, 'broker');
  assert.object(envelope, 'envelope');
  assert.object(pipeline, 'pipeline');
  assert.string(routeName, 'routeName');
  assert.object(routePattern, 'routePattern');
  assert.object(logger, 'logger');

  this._broker = broker;
  this._envelope = envelope;
  this._pipeline = pipeline;
  this._routeName = routeName;
  this._routePattern = routePattern;
  this._logger = logger;

  this._broker.registerRoute(this._routeName, this._routePattern);
}

Publisher.prototype._getMessage = function(data, kind) {
  return this._envelope.getMessage(data, kind);
};

Publisher.prototype._getRoutingKey = function(data, kind) {
  return this._envelope.getRoutingKey(data, kind);
};

Publisher.prototype._getSerializedContent = function(payload) {
  return this._envelope.serialize(payload);
};

Publisher.prototype._getPublishOptions = function(msg, perCallPublishOptions) {
  var publishOptions = {};

  var defaults = {
    persistent: true
  };

  _.assign(publishOptions, defaults, msg.properties, perCallPublishOptions);

  return publishOptions;
};

Publisher.prototype._publish = function(message, kind, options){
  var routeName = this._routeName;
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
Publisher.prototype.use = function(middleware) {
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
Publisher.prototype.publish = function(eventName, data, options) {
  assert.string(eventName, 'eventName');
  assert.optionalObject(data, 'data');
  assert.optionalObject(options, 'options');

  this._logger.info('Publishing event message for event ' + eventName);
  return this._publish(data, eventName, options);
};

/**
 * Send a message (command)
 *
 * @public
 * @method
 * @param {Any} message - message to be sent (required)
 * @param {String} messageType - message type (optional)
 * @param {Object} options - publishing options (optional)
 * @returns {Promise} a promise that is fulfilled when the message is sent
 */
Publisher.prototype.send = function(message, messageType, options) {
  assert.object(message, 'message');
  assert.optionalString(messageType, 'messageType');
  assert.optionalObject(options, 'options');

  this._logger.info('Publishing command message with type ' + messageType);
  return this._publish(message, messageType, options);
};

/**
 * Gets the route being used for publishing
 *
 * @public
 * @method
 * @returns {Object} details of the route
 */
Publisher.prototype.getRoute = function(){
  var brokerRoute = this._broker.getRouteParams();
  brokerRoute.name = this._routeName;
  brokerRoute.pattern = this._routePattern;
  return brokerRoute;
};

module.exports = Publisher;

