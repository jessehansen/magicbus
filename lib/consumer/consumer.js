const assert = require('assert')
const Pipe = require('magicpipes')
const MessageContext = require('./message-context')

const Consumer = ({
  broker,
  logger,
  events,
  consumeFilters,
  messageInputFilters,
  messageOutputFilters
}) => {
  let consuming = false
  let handler = null

  const consumePipe = Pipe(consumeFilters)

  const executeHandler = async (ctx, next) => {
    try {
      let handlerResult = handler(ctx)
      if (handlerResult && handlerResult.then) {
        await handlerResult
      }
    } catch (error) {
      events.emit('unhandled-error', {
        message: ctx.message,
        messageTypes: ctx.messageTypes,
        error
      })
      logger.error('Handler failed with error, rejecting message.', error)
      return ctx.reject()
    }
    await next(ctx)
  }

  const messagePipe = Pipe(messageInputFilters.concat(executeHandler).concat(messageOutputFilters))

  const consumeCallback = async (originalMessage, ops) => {
    // Magicbus assumes that all the messages coming from the queue have the same
    // serialization, all the middleware can process all the messages, and that
    // they all use the same envelope. Use different queues (different routeName)
    // to setup consumers for messages that need different handling.

    let context = MessageContext(originalMessage)
    await messagePipe.send(context)
    let outcome = context.outcome() || 'ack'
    logger.silly(`Message consumed with outcome: ${outcome}`)
    switch (outcome) {
      case 'ack':
        ops.ack()
        break
      case 'nack':
        ops.nack()
        break
      default:
        ops.reject()
        break
    }
  }

  const startConsuming = async (messageCallback, options) => {
    if (consuming) {
      logger.error('Attempted to start consuming on a consumer that was already active')
      assert.fail('Already consuming')
    }

    consuming = true
    handler = messageCallback

    let context = { options }
    await consumePipe.send(context)

    logger.info('Begin consuming messages')
    return broker.consume(context, consumeCallback)
  }

  const purgeQueue = async () => {
    let context = {}
    await consumePipe.send(context)
    broker.purgeQueue(context.queue)
  }

  const getBindingTarget = async () => {
    let context = {}
    await consumePipe.send(context)
    let { exchange, queue } = context
    // we prefer exchange->exchange binding, assume topology sets up exchange->queue binding
    // if it returns an exchange
    let isQueue = !exchange
    return {
      name: isQueue ? queue : exchange,
      queue: isQueue
    }
  }

  return {
    startConsuming,
    purgeQueue,
    getBindingTarget
  }
}
module.exports = Consumer
