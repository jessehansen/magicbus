'use strict';

const assert = require('assert-plus');
const _ = require('lodash');

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

  broker.registerRoute(routeName, routePattern);

  /**
   * Gets publish options for a given message
   * @private
   */
  const getPublishOptions = (msg, perCallPublishOptions) => {
    let publishOptions = {};

    const defaults = {
      persistent: true
    };

    _.assign(publishOptions, defaults, msg.properties, perCallPublishOptions);

    return publishOptions;
  };

  /**
   * Do the work of publishing a message
   *
   * @private
   * @method
   * @param {Object} message - the message payload (serialized by envelope)
   * @param {String} kind - message type
   * @param {Object} options - publishing options (optional)
   * @returns {Promise} a promise that is fulfilled when the message is published
   */
  const doPublish = (message, kind, options) => {
    let msg = envelope.getMessage(message, kind);
    return pipeline.prepare()(msg).then(() => {
      let routingKey = envelope.getRoutingKey(message, kind);
      let content = envelope.serialize(msg.payload);
      let publishOptions = getPublishOptions(msg, (options || {}).publishOptions);

      return broker.publish(routeName, routingKey, content, publishOptions);
    });
  };

  /**
   * Use a middleware function
   *
   * @public
   * @method
   * @param {Function} middleware - middleware to run {@see middleware.contract}
   */
  const use = (middleware) => {
    pipeline.use(middleware);
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
  const publish = (eventName, data, options) => {
    assert.string(eventName, 'eventName');
    assert.optionalObject(data, 'data');
    assert.optionalObject(options, 'options');

    logger.info('Publishing event message for event ' + eventName);
    return doPublish(data, eventName, options);
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
  const send = (message, messageType, options) => {
    assert.object(message, 'message');
    assert.optionalString(messageType, 'messageType');
    assert.optionalObject(options, 'options');

    logger.info('Publishing command message with type ' + messageType);
    return doPublish(message, messageType, options);
  };

  /**
   * Gets the route being used for publishing
   *
   * @public
   * @method
   * @returns {Object} details of the route
   */
  const getRoute = () => {
    let brokerRoute = broker.getRouteParams();
    brokerRoute.name = routeName;
    brokerRoute.pattern = routePattern;
    return brokerRoute;
  };

  return {
    use: use,
    publish: publish,
    send: send,
    getRoute: getRoute
  };
}

module.exports = Publisher;

