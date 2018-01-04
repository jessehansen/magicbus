// initial version from https://github.com/LeanKit-Labs/wascally

const _ = require('lodash')
const Promise = require('bluebird')

/**
 * Contains methods for defining and publishing to exchanges
 * @constructor
 * @private
 * @param {Object} options - details in creating the exchange - passed to amqplib's assertExchange function
 * @param {String} options.name - exchange name
 * @param {String} options.type - exchange type
 * @param {bool} options.durable - if true, the exchange will survive broker restarts. Defaults to true.
 * @param {bool} options.internal - if true, messages cannot be published directly to the exchange (i.e., it can
      only be the target of bindings, or possibly create messages ex-nihilo). Defaults to false.
 * @param {bool} options.autoDelete - if true, the exchange will be destroyed once the number of bindings for which
      it is the source drop to zero. Defaults to false.
 * @param {String} options.alternateExchange - an exchange to send messages to if this exchange can't route them
      to any queues. Alias: options.alternate
 * @param {Object} options.arguments - any additional arguments that may be needed by an exchange type.
 * @param {Topology} topology - the topology instance
 * @param {PublishLog} publishLog - the publish log instance
 * @param {Logger} log - the logger
 */
module.exports = function Exchange (options, topology, publishLog, log) {
  const exLog = log.withNamespace('exchange')
  const topLog = log

  let channel = topology.connection.createChannel(true)
  channel.name = 'exchange-channel-' + options.name
  let connectionName = topology.connection.name
  let drain = []

  channel.on('drain', () => {
    exLog.silly('got drain')
    for (let i = 0; i < drain.length; i++) {
      drain[i]()
    }
    drain = []
  })

  /**
   * Get options for amqp assertExchange call
   * @private
   */
  function getLibOptions (aliases, itemsToOmit) {
    let aliased = _.transform(options, function (result, value, key) {
      let alias = aliases[key]
      result[alias || key] = value
    })
    return _.omit(aliased, itemsToOmit)
  }

  /**
   * Define the exchange
   * @public
   */
  function define () {
    let libOptions = getLibOptions({
      alternate: 'alternateExchange'
    }, ['persistent', 'publishTimeout'])
    topLog.debug(`Declaring ${options.type} exchange '${options.name}' on connection '${connectionName}' ` +
      `with the options: ${JSON.stringify(_.omit(libOptions, ['name', 'type']))}`)
    return channel.assertExchange(options.name, options.type, libOptions)
  }

  /**
   * Destroy the exchange
   * @public
   */
  function destroy () {
    if (channel) {
      channel.destroy()
      channel = undefined
    }
    return Promise.resolve(true)
  }

  /* eslint-disable complexity */
  /**
   * Get publish options for the message to send to amqplib's publish call
   * @private
   */
  function getPublishOptions (message) {
    let publishOptions = {
      type: message.type || '',
      contentType: message.contentType,
      contentEncoding: message.contentEncoding,
      correlationId: message.correlationId || '',
      replyTo: message.replyTo || '',
      messageId: message.messageId || message.id || '',
      timestamp: message.timestamp,
      appId: message.appId || '',
      headers: message.headers || {},
      expiration: message.expiresAfter || undefined,
      persistent: message.persistent !== false
    }
    if (publishOptions.replyTo === 'amq.rabbitmq.reply-to') {
      publishOptions.headers['direct-reply-to'] = 'true'
    }
    return publishOptions
  }
  /* eslint-enable complexity */

  /**
   * Publish a message to the exchange
   * @public
   * @param {Object} message
   * @param {Buffer} message.payload - the encoded message payload
   * @param {String} message.routingKey - the message's routing key. If not specified, message.type is used
   * @param {String} message.type - an arbitrary application-specific type for the message
   * @param {String} message.contentType - a MIME type for the message content
   * @param {String} message.contentEncoding - a MIME encoding for the message content
   * @param {String} message.expiresAfter - if supplied, the message will be discarded from a queue once it has
        been there longer than the given number of milliseconds. In the specification this is a string; numbers
        supplied here will be coerced to strings for transit.
   * @param {Object} message.headers - application specific headers to be carried along with the message content.
        The value as sent may be augmented by extension-specific fields if they are given in the parameters, for
        example, 'CC', since these are encoded as message headers; the supplied value won't be mutated
   * @param {String} message.correlationId - usually used to match replies to requests, or similar
   * @param {String} message.replyTo - often used to name a queue to which the receiving application must send
        replies, in an RPC scenario (many libraries assume this pattern)
   * @param {String} message.messageId - arbitrary application-specific identifier for the message. If not specified,
        message.id is used
   * @param {Numeric} message.timestamp - a timestamp for the message
   * @param {String} message.appId - an arbitrary identifier for the originating application
   * @returns {Promise} a promise that is resolved once the message is published
   */
  function publish (message) {
    let channelName = options.name
    let type = options.type
    let payload = message.payload
    let publishOptions = getPublishOptions(message)
    if (!message.sequenceNo) {
      publishLog.add(message)
    }

    let effectiveKey = message.routingKey === '' ? '' : message.routingKey || publishOptions.type
    exLog.silly(`Publishing message (type: ${publishOptions.type} topic: ${effectiveKey}, ` +
      `sequence: ${message.sequenceNo}, correlation: ${publishOptions.correlationId}, ` +
      `replyTo: ${publishOptions.replyTo}) to ${type} exchange ${channelName} - ${connectionName}`)

    return channel.publish(channelName, effectiveKey, payload, publishOptions).then((result) => {
      if (result === false) {
        exLog.silly('write buffer full, waiting for drain')
        return new Promise((resolve) => {
          drain.push(resolve)
        })
      }
      return Promise.resolve()
    })
  }

  return {
    channel: channel,
    define: define,
    destroy: destroy,
    publish: publish
  }
}
