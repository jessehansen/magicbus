const assert = require('assert')
const defaultPublishOptions = { persistent: true }

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
function Publisher (broker, envelope, serializer, pipeline, routeName, routePattern, logger) {
  broker.registerRoute(routeName, routePattern)
  pipeline.useLogger(logger)

  /**
   * Gets publish options for a given message
   * @private
   */
  const getPublishOptions = (msg, perCallPublishOptions,  envelopePublishOptions) =>
    Object.assign({}, defaultPublishOptions, msg.properties, perCallPublishOptions, envelopePublishOptions)

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
  const doPublish = (message, kind, options = {}) => {
    let msg = envelope.wrap(message, kind, serializer)
    // TODO: need to rework this so the envelope step and serialize step are different,
    // maybe in a decorator pipeline
    return pipeline.prepare()(msg, options).then(() => {
      let messageParameters =
        getPublishOptions(msg, options.publishOptions, envelope.getPublishOptions(message, kind, serializer))
      messageParameters.payload = serializer.serialize(msg.payload)

      return broker.publish(routeName, messageParameters)
    })
  }

  /**
   * Use a middleware function
   *
   * @public
   * @method
   * @param {Function} middleware - middleware to run {@see middleware.contract}
   */
  const use = (middleware) => {
    pipeline.use(middleware)
  }

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
    typeof eventName === 'string' ||
      assert.fail('eventName must be a string')

    logger.info('Publishing event message for event ' + eventName)
    return doPublish(data, eventName, options)
  }

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
    message ||
      assert.fail('message must be provided')
    !messageType || typeof messageType === 'string' ||
      assert.fail('messageType must be a string')

    logger.info('Publishing command message with type ' + messageType)
    return doPublish(message, messageType, options)
  }

  /**
   * Gets the route being used for publishing
   *
   * @public
   * @method
   * @returns {Object} details of the route
   */
  const getRoute = () => {
    let brokerRoute = broker.getRouteParams()
    brokerRoute.name = routeName
    brokerRoute.pattern = routePattern
    return brokerRoute
  }

  return {
    use: use,
    publish: publish,
    send: send,
    getRoute: getRoute
  }
}

module.exports = Publisher

