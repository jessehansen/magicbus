// initial version from https://github.com/LeanKit-Labs/wascally
const Exchange = (options, connection, publishLog, log) => {
  const exLog = log.withNamespace('exchange')
  const topLog = log

  let channel = connection.createChannel(true)
  channel.name = 'exchange-channel-' + options.name
  let connectionName = connection.name
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
  const getLibOptions = (aliases, itemsToOmit) =>
    Object.entries(options).reduce((result, [key, value]) => {
      let alias = aliases[key]
      if (itemsToOmit.indexOf(alias || key) < 0) {
        result[alias || key] = value
      }
      return result
    }, {})

  /**
   * Define the exchange
   * @public
   */
  const define = () => {
    if (options.check) {
      topLog.debug(`Connecting to ${options.type} exchange '${options.name}' on connection '${connectionName}'`)
      return channel.checkExchange(options.name)
    }
    let libOptions = getLibOptions({ alternate: 'alternateExchange' }, ['persistent', 'publishTimeout'])
    topLog.debug(`Declaring ${options.type} exchange '${options.name}' on connection '${connectionName}' ` +
      `with the options: ${JSON.stringify(libOptions)}`)
    return channel.assertExchange(options.name, options.type, libOptions)
  }

  /**
   * Destroy the exchange
   * @public
   */
  const destroy = () => {
    if (channel) {
      channel.destroy()
      channel = undefined
    }
    return Promise.resolve(true)
  }

  /**
   * Get publish options for the message to send to amqplib's publish call
   * @private
   */
  const getPublishOptions = (message) => {
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
  const publish = (message) => {
    let channelName = options.name
    let type = options.type

    let { content: payload, routingKey } = message
    let publishOptions = getPublishOptions(message.options)
    if (!message.sequenceNo) {
      publishLog.add(message)
    }

    exLog.silly(`Publishing message (type: ${publishOptions.type} topic: ${routingKey}, ` +
      `sequence: ${message.sequenceNo}, correlation: ${publishOptions.correlationId}, ` +
      `replyTo: ${publishOptions.replyTo}) to ${type} exchange ${channelName} - ${connectionName}`)

    return channel.publish(channelName, routingKey, payload, publishOptions).then((result) => {
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

module.exports = Exchange
