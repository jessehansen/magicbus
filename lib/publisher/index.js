const assert = require('assert')
const BindingSourceContext = require('../context/binding-source')
const PublishContext = require('../context/publish')
const Pipe = require('magicpipes')

const Publisher = ({
  broker,
  logger,
  inputFilters = [],
  outputFilters = []
}) => {
  const defaultPipe = Pipe(inputFilters.concat(outputFilters))
  const input = Pipe(inputFilters)

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
  const doPublish = async ({ message, kind, options, pipe }) => {
    let context = PublishContext({ message, kind, options })
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
  const publish = (eventName, data, { pipe, ...options } = {}) => {
    typeof eventName === 'string' ||
      assert.fail('eventName must be a string')

    logger.info('Publishing event message for event ' + eventName)
    return doPublish({ message: data, kind: eventName, options, pipe })
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
  const send = (message, messageType, { pipe, ...options } = {}) => {
    message ||
      assert.fail('message must be provided')
    !messageType || typeof messageType === 'string' ||
      assert.fail('messageType must be a string')

    logger.info('Publishing command message with type ' + messageType)
    return doPublish({ message, kind: messageType, options, pipe })
  }

  const getBindingSource = async () => {
    let context = BindingSourceContext({})
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
