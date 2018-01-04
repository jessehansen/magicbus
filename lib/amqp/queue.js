// initial version from https://github.com/LeanKit-Labs/wascally

const _ = require('lodash')
const AckBatch = require('../ack-batch.js')
const Promise = require('bluebird')
const noOp = function () {}

/**
 * Contains methods for defining and subscribing from queues
 * @constructor
 * @private
 * @param {Object} options - details in creating the queue - passed to amqplib's assertExchange function
 * @param {String} options.name - queue name
 * @param {bool} options.noBatch - if true, ack/nack/reject operations will execute immediately and not be batched
 * @param {bool} options.noAck - if true, the broker won't expect an acknowledgement of messages delivered to this
      consumer; i.e., it will dequeue messages as soon as they've been sent down the wire. Defaults to false (i.e.,
      you will be expected to acknowledge messages).
 * @param {bool} options.exclusive - if true, scopes the queue to the connection (defaults to false)
 * @param {bool} options.durable - if true, the queue will survive broker restarts, modulo the effects of exclusive
      and autoDelete; this defaults to true if not supplied, unlike the others
 * @param {bool} options.autoDelete - if true, the queue will be deleted when the number of consumers drops to zero
      (defaults to false)
 * @param {Number} options.messageTtl (0 <= n < 2^32): expires messages arriving in the queue after n milliseconds
 * @param {Number} options.expires (0 < n < 2^32): the queue will be destroyed after n milliseconds of disuse, where
      use means having consumers, being declared (asserted or checked, in this API), or being polled with a #get.
 * @param {String} options.deadLetterExchange - an exchange to which messages discarded from the queue will be resent.
      Use deadLetterRoutingKey to set a routing key for discarded messages; otherwise, the message's routing key
      (and CC and BCC, if present) will be preserved. A message is discarded when it expires or is rejected or nacked,
      or the queue limit is reached. Aliased as options.deadletter
 * @param {String} options.deadLetterRoutingKey - routing key to set on discarded messages. Ignored if
      deadLetterExchange is not also set
 * @param {Number} options.maxLength - sets a maximum number of messages the queue will hold. Old messages will be
      discarded (dead-lettered if that's set) to make way for new messages. Aliased as options.queueLimit
 * @param {Number} options.maxPriority -  makes the queue a priority queue.
 * @param {Object} options.arguments - additional arguments, usually parameters for some kind of broker-specific
      extension e.g., high availability, TTL.
 * @param {Topology} topology - the topology instance
 * @param {PublishLog} publishLog - the publish log instance
 * @param {Logger} log - the logger
 */
module.exports = function (options, topology, log) {
  let qLog = log.withNamespace('queue')
  let topLog = log

  let channel = topology.connection.createChannel(true)
  let channelName = options.name
  channel.name = 'queue-channel-' + options.name
  let connectionName = topology.connection.name

  /**
   * Op resolvers for AckBatch class
   * @private
   */
  const resolver = (op, data) => {
    switch (op) {
      case 'ack':
        qLog.debug(`Acking tag ${data.tag} on ${channelName} - ${connectionName}`)
        return channel.ack({ fields: { deliveryTag: data.tag } }, data.inclusive)
      case 'nack':
        qLog.debug(`Nacking tag ${data.tag} on ${channelName} - ${connectionName}`)
        return channel.nack({ fields: { deliveryTag: data.tag } }, data.inclusive)
      case 'reject':
        qLog.debug(`Rejecting tag ${data.tag} on ${channelName} - ${connectionName}`)
        return channel.nack({ fields: { deliveryTag: data.tag } }, data.inclusive, false)
      default:
        return Promise.resolve(true)
    }
  }

  let messages = AckBatch(channelName, connectionName, resolver, log)

  /**
   * Get options for amqp assertQueue call
   * @private
   */
  function getAssertQueueOptions () {
    const aliases = {
      queueLimit: 'maxLength',
      deadLetter: 'deadLetterExchange',
      deadLetterRoutingKey: 'deadLetterRoutingKey'
    }
    const itemsToOmit = ['limit', 'noBatch']

    let aliased = _.transform(options, function (result, value, key) {
      let alias = aliases[key]
      result[alias || key] = value
    })

    return _.omit(aliased, itemsToOmit)
  }

  /**
   * Purge message queue. Useful for testing
   * @public
   */
  function purge () {
    qLog.info(`Purging queue ${channelName} - ${connectionName}`)
    return channel.purgeQueue(channelName).then(function () {
      qLog.debug(`Successfully purged queue ${channelName} - ${connectionName}`)
    })
  }

  /**
   * Get unresolved message count
   * @public
   */
  function getMessageCount () {
    if (messages) {
      return messages.messages.length
    }
    return 0
  }

  /**
   * Get message operations for a tracked & batched queue
   * @private
   */
  function getTrackedOps (raw) {
    return messages.getMessageOps(raw.fields.deliveryTag)
  }

  /**
   * Get message operations for an untracked queue
   * @private
   */
  function getUntrackedOps () {
    messages.receivedCount += 1
    return {
      ack: noOp,
      nack: noOp,
      reject: noOp
    }
  }

  /**
   * Get message operations for an unbatched queue
   * @private
   */
  function getNoBatchOps (raw) {
    messages.receivedCount += 1

    return {
      ack: function () {
        qLog.debug(`Acking tag ${raw.fields.deliveryTag} on ${messages.name} - ${messages.connectionName}`)
        channel.ack({ fields: { deliveryTag: raw.fields.deliveryTag } }, false)
      },
      nack: function () {
        qLog.debug(`Nacking tag ${raw.fields.deliveryTag} on ${messages.name} - ${messages.connectionName}`)
        channel.nack({ fields: { deliveryTag: raw.fields.deliveryTag } }, false)
      },
      reject: function () {
        qLog.debug(`Rejecting tag ${raw.fields.deliveryTag} on ${messages.name} - ${messages.connectionName}`)
        channel.nack({ fields: { deliveryTag: raw.fields.deliveryTag } }, false, false)
      }
    }
  }

  /**
   * Get message operations
   * @private
   */
  function getResolutionOperations (raw, consumeOptions) {
    if (consumeOptions.noAck) {
      return getUntrackedOps(raw)
    }

    if (consumeOptions.noBatch) {
      return getNoBatchOps(raw)
    }

    return getTrackedOps(raw)
  }

  /**
   * Subscribe to the queue's messages
   * @public
   * @param {Function} callback - the function to call for each message received from queue. Should have
        signature function (message, operations) where operations contains ack, nack, and reject functions
   * @param {Object} subscribeOptions - details in consuming from the queue. Overrides any equivalent options
        sent in to Queue constructor - passed to amqplib's consume function
   * @param {Number} subscribeOptions.limit - the channel prefetch limit
   * @param {bool} subscribeOptions.noAck - if true, the broker won't expect an acknowledgement of messages
        delivered to this consumer; i.e., it will dequeue messages as soon as they've been sent down the wire.
        Defaults to false (i.e., you will be expected to acknowledge messages).
   * @param {bool} subscribeOptions.noBatch - if true, ack/nack/reject operations will execute immediately and
        not be batched
   * @param {String} subscribeOptions.consumerTag - a name which the server will use to distinguish message
        deliveries for the consumer; mustn't be already in use on the channel. It's usually easier to omit this,
        in which case the server will create a random name and supply it in the reply.
   * @param {bool} subscribeOptions.exclusive - if true, the broker won't let anyone else consume from this queue;
        if there already is a consumer, there goes your channel (so usually only useful if you've made a 'private'
        queue by letting the server choose its name).
   * @param {Number} subscribeOptions.priority - gives a priority to the consumer; higher priority consumers get
        messages in preference to lower priority consumers. See the RabbitMQ extension's documentation
   * @param {Object} subscribeOptions.arguments -  arbitrary arguments. Go to town.
  */
  function subscribe (callback, subscribeOptions) {
    let consumeOptions = {}
    _.assign(consumeOptions, options, subscribeOptions)
    consumeOptions = _.pick(consumeOptions, ['consumerTag', 'noAck', 'noBatch', 'limit', 'exclusive', 'priority', 'arguments'])

    let shouldAck = !consumeOptions.noAck
    let shouldBatch = !consumeOptions.noBatch

    if (shouldAck && shouldBatch) {
      messages.listenForSignal()
    }

    qLog.info(`Starting subscription ${channelName} - ${connectionName} with ${JSON.stringify(consumeOptions)}`)
    return (consumeOptions.limit !== false ? channel.prefetch(consumeOptions.limit || 500) : Promise.resolve())
      .then(() => {
        function handler (raw) {
          let ops = getResolutionOperations(raw, consumeOptions)
          qLog.silly(`Received message on queue ${channelName} - ${connectionName}`)

          if (shouldAck && shouldBatch) {
            messages.addMessage(ops.message)
          }

          try {
            callback(raw, ops)
          } catch (e) {
            qLog.error(`Error handing message on queue ${channelName} - ${connectionName}`, e)
            ops.reject()
          }
        }
        return channel.consume(channelName, handler, _.omit(consumeOptions, ['noBatch', 'limit']))
      }).then(function (result) {
        channel.tag = result.consumerTag
        return result
      })
  }

  /**
   * Unsubscribe from the queue (stop calling the message handler)
   * @public
   */
  function unsubscribe () {
    if (channel.tag) {
      qLog.info(`Unsubscribing from queue ${channelName} with tag ${channel.tag}`)
      return channel.cancel(channel.tag)
    }
    return Promise.resolve()
  }

  /**
   * Define the queue
   * @public
   */
  function define () {
    let aqOptions = getAssertQueueOptions()
    topLog.info(`Declaring queue '${channelName}' on connection '${connectionName}' with the options: ${JSON.stringify(_.omit(aqOptions, ['name']))}`)
    return channel.assertQueue(channelName, aqOptions)
  }

  /**
   * Destroy the queue

   * @public
   */
  function destroy (released) {
    function flush () {
      if (messages.messages.length > 0 && !released) {
        return messages.flush()
      }
      return Promise.resolve()
    }

    function finalize () {
      messages.ignoreSignal()
      channel.destroy()
      channel = undefined
    }

    return flush().then(function () {
      return unsubscribe(channel, options)
    }).then(finalize, finalize)
  }

  return {
    channel: channel,
    messages: messages,
    define: define,
    destroy: destroy,
    getMessageCount: getMessageCount,
    subscribe: subscribe,
    unsubscribe: unsubscribe,
    purge: purge
  }
}
