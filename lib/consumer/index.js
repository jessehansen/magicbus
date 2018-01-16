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
    broker.purgeQueue(context)
  }

  return {
    startConsuming,
    purgeQueue
  }
}
module.exports = Consumer
