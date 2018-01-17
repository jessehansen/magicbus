const assert = require('assert')
const BindingTargetContext = require('../context/binding-target')
const ConsumeContext = require('../context/consume')
const MessageContext = require('../context/message')
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

  const executeHandler = async (ctx, next) => {
    try {
      let handlerResult = handler(ctx)
      if (handlerResult && handlerResult.then) {
        await handlerResult
      }
    } catch (err) {
      events.emit('unhandled-error', {
        message: ctx.message,
        messageTypes: ctx.messageTypes,
        err
      })
      logger.error('Handler failed with error, rejecting message.', err)
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
      case 'reject':
        ops.reject()
        break
      default:
        logger.error(`Unsupported message outcome: ${outcome}, rejecting`)
        ops.reject()
    }
  }

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

  const purgeQueue = async () => {
    let context = ConsumeContext({})
    await consumePipe.send(context)
    broker.purgeQueue(context.queue)
  }

  const getBindingTarget = async () => {
    let context = BindingTargetContext({})
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
