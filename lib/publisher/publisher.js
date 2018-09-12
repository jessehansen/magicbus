const assert = require('assert')
const Pipe = require('magicpipes')

const Publisher = ({
  broker,
  logger,
  inputFilters,
  outputFilters
}) => {
  const defaultPipe = Pipe(inputFilters.concat(outputFilters))
  const input = Pipe(inputFilters)

  const doPublish = async ({ message, kind, options, pipe }) => {
    let context = { message, kind, publishOptions: options }
    if (pipe) {
      await pipe.prepend(inputFilters).append(outputFilters).send(context)
    } else {
      await defaultPipe.send(context)
    }
    return await broker.publish({
      exchange: context.exchange,
      routingKey: context.routingKey,
      content: context.content,
      options: context.publishOptions
    })
  }

  const publish = (eventName, data, { pipe, ...options } = {}) => {
    typeof eventName === 'string' ||
      assert.fail('eventName must be a string')

    logger.info('Publishing event message for event ' + eventName)
    return doPublish({ message: data, kind: eventName, options, pipe })
  }

  const send = (message, messageType, { pipe, ...options } = {}) => {
    message ||
      assert.fail('message must be provided')
    !messageType || typeof messageType === 'string' ||
      assert.fail('messageType must be a string')

    logger.info('Publishing command message with type ' + messageType)
    return doPublish({ message, kind: messageType, options, pipe })
  }

  const getBindingSource = async () => {
    let context = {}
    await input.send(context)
    return { name: context.exchange }
  }

  return {
    publish,
    send,
    getBindingSource
  }
}
module.exports = Publisher
