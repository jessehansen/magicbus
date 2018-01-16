const assert = require('assert')
const ConsumeContext = require('./context/consume')
const MessageContext = require('./context/message')
const Pipe = require('magicpipes')

const Consumer = ({
  broker,
  logger,
  events,
  consumeFilters = [],
  messageInputFilters = [],
  messageOutputFilters = []
}) => {
  let consuming = false
  let handler = null

  const consumePipe = Pipe(consumeFilters)
  const input = Pipe(messageInputFilters)
  const output = Pipe(messageOutputFilters)

  const consumeCallback = async (originalMessage, ops) => {
    // Magicbus assumes that all the messages coming from the queue have the same
    // serialization, all the middleware can process all the messages, and that
    // they all use the same envelope. Use different queues (different routeName)
    // to setup consumers for messages that need different handling.

    let context = MessageContext({ originalMessage })

    try {
      await input.send(context)
      let handlerResult = handler(context)
      if (handlerResult && handlerResult.then) {
        await handlerResult
      }
      await output.send(context)
    } catch (err) {
      events.emit('unhandled-error', {
        message: context.message,
        messageTypes: context.messageTypes,
        error: err
      })
      logger.error('Handler failed with error, rejecting message.', err)
      ops.reject()
      return
    }
    let outcome = context.outcome() || 'ack'
    logger.silly(`Message consumed with outcome: ${outcome}`)
    switch (outcome) {
      case 'ack':
        ops.ack()
        break
      case 'nack':
        ops.nack()
        break
      case 'reject':
        ops.reject()
        break
      default:
        logger.error(`Unsupported message outcome: ${outcome}, rejecting`)
        ops.reject()
    }
  }

  /**
   * Start consuming messages from the queue
   *
   * @public
   * @method
   * @memberOf Consumer.prototype
   * @param {Consumer.handlerCallback} messageCallback - message handler callback
   * @param {Object} options - details in consuming from the queue
   * @param {Number} options.limit - the channel prefetch limit
   * @param {bool} options.noBatch - if true, ack/nack/reject operations will execute immediately and not be batched
   * @param {bool} options.noAck - if true, the broker won't expect an acknowledgement of messages delivered to this
        consumer; i.e., it will dequeue messages as soon as they've been sent down the wire. Defaults to false (i.e.,
        you will be expected to acknowledge messages).
   * @param {String} options.consumerTag - a name which the server will use to distinguish message deliveries for the
        consumer; mustn't be already in use on the channel. It's usually easier to omit this, in which case the server
        will create a random name and supply it in the reply.
   * @param {bool} options.exclusive - if true, the broker won't let anyone else consume from this queue; if there
        already is a consumer, there goes your channel (so usually only useful if you've made a 'private' queue by
        letting the server choose its name).
   * @param {Number} options.priority - gives a priority to the consumer; higher priority consumers get messages in
        preference to lower priority consumers. See this RabbitMQ extension's documentation
   * @param {Object} options.arguments -  arbitrary arguments. Go to town.
   */
  const startConsuming = async (messageCallback, options) => {
    if (consuming) {
      logger.error('Attempted to start consuming on a consumer that was already active')
      assert.fail('Already consuming')
    }

    consuming = true
    handler = messageCallback

    let context = ConsumeContext({ options })
    await consumePipe.send(context)

    logger.info('Begin consuming messages')
    return broker.consume(context, consumeCallback)
  }

  /**
   * Purges messages from a route's queue. Useful for testing, to ensure your queue is empty before consuming
   *
   * @public
   * @method
   * @memberOf Consumer.prototype
   * @returns {Object} details of the route
   */
  const purgeQueue = async () => {
    let context = ConsumeContext({})
    await consumePipe.send(context)
    broker.purgeQueue(context)
  }

  return {
    startConsuming,
    purgeQueue
  }
}

/**
 * Message consumption callback
 * @callback handlerCallback
 * @memberOf Consumer
 * @param {Object} data - unpacked data
 * @param {Array} messageTypes - unpacked message types
 * @param {Object} message - raw message
 */
module.exports = Consumer
