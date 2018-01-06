const assert = require('assert-plus')
const Promise = require('bluebird')

/**
 * Handles consumption of event messages from the bus
 *
 * @public
 * @constructor
 * @param {Object} consumer - instance of the {@link Consumer} class
 * @param {Object} eventDispatcher - instance of the {@link EventDispatcher} class
 * @param {Object} logger - the logger
 * @param {EventEmitter} events - the event emitter for unhandled exception events
 */
function Subscriber (consumer, eventDispatcher, logger, events) {
  assert.object(consumer, 'consumer')
  assert.object(eventDispatcher, 'eventDispatcher')
  assert.object(logger, 'logger')
  assert.object(events, 'events')

  /**
   * Internal message handler, passes message to event dispatcher
   *
   * @private
   * @method
   * @param {Any} data - message payload
   * @param {Array} messageTypes - message types
   * @param {Object} msg - raw message
   */
  const internalHandler = (data, messageTypes, msg) => {
    logger.debug('Subscriber received message with types ' + JSON.stringify(messageTypes) + ', handing off to event dispatcher.')
    return eventDispatcher.dispatch(messageTypes, data, msg)
      .catch((err) => {
        events.emit('unhandled-error', {
          data: data,
          messageTypes: messageTypes,
          message: msg,
          error: err
        })
        logger.error('Error during message dispatch', err)
        return Promise.reject(err)
      })
      .then((executed) => {
        if (!executed) {
          events.emit('unhandled-event', {
            data: data,
            messageTypes: messageTypes,
            message: msg
          })
          return Promise.reject(new Error('No handler registered'))
        }
        return Promise.resolve()
      })
  }

  /**
   * Subscribe to an event
   *
   * @public
   * @method
   * @param {String} eventName - name of event (required)
   * @param {Subscriber.handlerCallback} handler - the handler to be called with the message
   */
  const on = (eventName, handler) => {
    eventDispatcher.on(eventName, handler)
  }

  /**
   * Subscribe to an event, for one iteration only
   *
   * @public
   * @method
   * @param {String} eventName - name of event (required)
   * @param {Subscriber.handlerCallback} handler - the handler to be called with the message
   * @returns {Promise} a promise that is fulfilled when the event has been fired - useful for automated testing
        of handler behavior
   */
  const once = (eventName, handler) => eventDispatcher.once(eventName, handler)

  /**
   * Use a middleware function
   *
   * @public
   * @method
   * @param {Function} middleware - middleware to run {@see middleware.contract}
   */
  const use = (middleware) => {
    consumer.use(middleware)
  }

  /**
   * Start consuming events
   *
   * @param {Object} options - details in consuming from the queue
   * @param {Number} options.limit - the channel prefetch limit
   * @param {bool} options.noBatch - if true, ack/nack/reject operations will execute immediately and not be batched
   * @param {bool} options.noAck - if true, the broker won't expect an acknowledgement of messages delivered to this
        consumer; i.e., it will dequeue messages as soon as they've been sent down the wire. Defaults to false
        (i.e., you will be expected to acknowledge messages).
   * @param {String} options.consumerTag - a name which the server will use to distinguish message deliveries for the
        consumer; mustn't be already in use on the channel. It's usually easier to omit this, in which case the server
        will create a random name and supply it in the reply.
   * @param {bool} options.exclusive - if true, the broker won't let anyone else consume from this queue; if there
        already is a consumer, there goes your channel (so usually only useful if you've made a 'private' queue
        by letting the server choose its name).
   * @param {Number} options.priority - gives a priority to the consumer; higher priority consumers get messages in
        preference to lower priority consumers. See the RabbitMQ extension's documentation
   * @param {Object} options.arguments -  arbitrary arguments. Go to town.
   * @public
   * @method
   */
  const startSubscription = (options) => consumer.startConsuming(internalHandler, options)

  /**
   * Gets the route being used for consuming
   *
   * @public
   * @method
   * @returns {Object} details of the route
   */
  const getRoute = () => consumer.getRoute()

  /**
   * Purges messages from a route's queue. Useful for testing, to ensure your queue is empty before subscribing
   *
   * @public
   * @method
   * @returns {Promise} a promise that is fulfilled when the queue has been purged
   */
  const purgeQueue = () => consumer.purgeQueue()

  return {
    on: on,
    once: once,
    use: use,
    startSubscription: startSubscription,
    getRoute: getRoute,
    purgeQueue: purgeQueue
  }
}

/**
 * Message consumption callback
 * @callback handlerCallback
 * @memberOf Subscriber
 * @param {String} eventName - name of event
 * @param {Any} data - unpacked message data
 * @param {Object} message - raw message
 */
module.exports = Subscriber

