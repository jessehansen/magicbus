const signal = require('postal').channel('rabbit.ack')

const createBroker = (serviceDomainName, appName, topology, logger) => {
  let closed = false
  let ackInterval = null

  /**
   * Asserts that the broker has not been shutdown and is ready for action
   *
   * @method
   * @private
   * @memberOf Broker.prototype
   */
  const activate = () => {
    if (closed) {
      throw new Error('Broker is shut down, no more connections allowed.')
    }
    if (!ackInterval) {
      ackInterval = setInterval(() => signal.publish('ack'), 500)
    }
  }

  const getExchange = (exchange) => {
    activate()
    return topology.channel(`exchange:${exchange}`)
  }

  const getQueue = (queue) => {
    activate()
    return topology.channel(`queue:${queue}`)
  }

  // TODO: Update documentation
  /**
   * Publish a message using the given parameters
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route
   * @param {Object} message
   * @param {Buffer} message.payload - the encoded message payload
   * @param {String} message.routingKey - the message's routing key. If not specified, message.type is used
   * @param {String} message.type - an arbitrary application-specific type for the message
   * @param {String} message.contentType - a MIME type for the message content
   * @param {String} message.contentEncoding - a MIME encoding for the message content
   * @param {String} message.expiresAfter - if supplied, the message will be discarded from a queue once it
        has been there longer than the given number of milliseconds. In the specification this is a string;
        numbers supplied here will be coerced to strings for transit.
   * @param {String} message.persistent - If truthy, the message will survive broker restarts provided it's
        in a queue that also survives restarts.
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
   * @returns {Promise} a promise representing the result of the publish call
   */
  const publish = ({
    exchange,
    routingKey = '',
    content,
    options
  }) => {
    let x = getExchange(exchange)
    logger.debug(`Publishing message to exchange ${x.name} with routing key '${routingKey}'`)
    return x.publish({ routingKey, content, options })
  }

  /**
   * Start consuming messages on the given route
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route
   * @param {Function} callback - function to be called with each message consumed
   * @returns {Promise} a promise that is fulfilled when the consume call is complete
   * @param {Object} options - details in consuming from the queue
   * @param {Number} options.limit - the channel prefetch limit
   * @param {bool} options.noBatch - if true, ack/nack/reject operations will execute immediately and not be batched
   * @param {bool} options.noAck - if true, the broker won't expect an acknowledgement of messages delivered to this
        consumer; i.e., it will dequeue messages as soon as they've been sent down the wire. Defaults to false
        (i.e., you will be expected to acknowledge messages).
   * @param {String} options.consumerTag - a name which the server will use to distinguish message deliveries for
        the consumer; mustn't be already in use on the channel. It's usually easier to omit this, in which case the
        server will create a random name and supply it in the reply.
   * @param {bool} options.exclusive - if true, the broker won't let anyone else consume from this queue; if there
        already is a consumer, there goes your channel (so usually only useful if you've made a 'private' queue by
        letting the server choose its name).
   * @param {Number} options.priority - gives a priority to the consumer; higher priority consumers get messages in
        preference to lower priority consumers. See this RabbitMQ extension's documentation
   * @param {Object} options.arguments - arbitrary arguments. Go to town.
   */
  const consume = ({ queue, options }, callback) => {
    let q = getQueue(queue)
    logger.debug(`Beginning consumption from queue ${q.name}`)
    return q.subscribe(callback, options).then(/* strip result from promise */)
  }

  /**
   * Purges messages from a route's queue. Useful for testing, to ensure your queue is empty before consuming
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route
   * @returns {Promise} a promise that is fulfilled when the queue is empty
   */
  const purgeQueue = (queue) =>
    getQueue(queue).purge()

  /**
   * Close the connection and all associated channels
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @returns {Promise} a promise that is fulfilled when the shutdown is complete
   */
  const shutdown = () => {
    if (closed) {
      return Promise.resolve()
    }
    closed = true
    logger.info('Shutting down broker connection')
    if (ackInterval) {
      clearInterval(ackInterval)
      ackInterval = null
    }
    if (topology) {
      return topology.connection.close(true).then(() => {
        topology = null
      })
    }
    return Promise.resolve()
  }

  const getTopologyParams = () => ({
    serviceDomainName,
    appName,
    topology
  })

  /**
   * Checks to see if a connection is established.
   *
   * @public
   * @method
   * @memberof Broker.prototype
   * @returns {Boolean} status of the connection
   */
  const isConnected = () => !!topology && !closed

  const bind = async (bindSource, bindTarget, { pattern = '' } = {}) => {
    let { name: source } = await bindSource.getBindingSource()
    let { name: target, isQueue } = await bindTarget.getBindingTarget()
    logger.info(`Binding "${source}" to "${target}" (${isQueue ? 'queue' : 'exchange'}) with pattern "${pattern}"`)
    await topology.createBinding({
      source,
      target,
      queue: isQueue,
      keys: [pattern]
    })
  }

  return {
    shutdown,
    isConnected,

    getTopologyParams,

    bind,
    publish,
    consume,
    purgeQueue
  }
}

module.exports = createBroker
