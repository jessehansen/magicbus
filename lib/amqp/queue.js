// initial version from https://github.com/LeanKit-Labs/wascally
const AckBatch = require('../ack-batch')
const { noOp } = require('../util')

const Queue = (options, connection, log) => {
  let qLog = log.withNamespace('queue')
  let topLog = log

  let channel = connection.createChannel(true)
  let channelName = options.name
  channel.name = 'queue-channel-' + options.name
  let connectionName = connection.name

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

  const getAssertQueueOptions = () => {
    const aliases = {
      queueLimit: 'maxLength',
      deadLetter: 'deadLetterExchange',
      deadLetterRoutingKey: 'deadLetterRoutingKey'
    }
    const itemsToOmit = ['limit', 'noBatch']

    return Object.entries(options).reduce((result, [key, value]) => {
      let alias = aliases[key]
      if (itemsToOmit.indexOf(alias || key) < 0) {
        result[alias || key] = value
      }
      return result
    }, {})
  }

  const purge = () => {
    qLog.info(`Purging queue ${channelName} - ${connectionName}`)
    return channel.purgeQueue(channelName).then(() => {
      qLog.debug(`Successfully purged queue ${channelName} - ${connectionName}`)
    })
  }

  const getMessageCount = () => messages ? messages.messageCount() : 0

  const getTrackedOps = (raw) => messages.getMessageOps(raw.fields.deliveryTag)

  const getUntrackedOps = () => {
    messages.incrementReceived()
    return {
      ack: noOp,
      nack: noOp,
      reject: noOp
    }
  }

  const getNoBatchOps = (raw) => {
    messages.incrementReceived()

    return {
      ack: () => {
        qLog.debug(`Acking tag ${raw.fields.deliveryTag} on ${messages.name} - ${messages.connectionName}`)
        channel.ack({ fields: { deliveryTag: raw.fields.deliveryTag } }, false)
      },
      nack: () => {
        qLog.debug(`Nacking tag ${raw.fields.deliveryTag} on ${messages.name} - ${messages.connectionName}`)
        channel.nack({ fields: { deliveryTag: raw.fields.deliveryTag } }, false)
      },
      reject: () => {
        qLog.debug(`Rejecting tag ${raw.fields.deliveryTag} on ${messages.name} - ${messages.connectionName}`)
        channel.nack({ fields: { deliveryTag: raw.fields.deliveryTag } }, false, false)
      }
    }
  }

  const getResolutionOperations = (raw, consumeOptions) => {
    if (consumeOptions.noAck) {
      return getUntrackedOps(raw)
    }

    if (consumeOptions.noBatch) {
      return getNoBatchOps(raw)
    }

    return getTrackedOps(raw)
  }

  const filterConsumeOptions = ({ consumerTag, noAck, noBatch, limit, exclusive, priority, arguments: args }) =>
    ({ consumerTag, noAck, noBatch, limit, exclusive, priority, arguments: args })

  const subscribe = (callback, subscribeOptions) => {
    let consumeOptions = filterConsumeOptions(Object.assign({}, options, subscribeOptions))

    let shouldAck = !consumeOptions.noAck
    let shouldBatch = !consumeOptions.noBatch

    if (shouldAck && shouldBatch) {
      messages.listenForSignal()
    }

    qLog.info(`Starting subscription ${channelName} - ${connectionName} with ${JSON.stringify(consumeOptions)}`)
    return (consumeOptions.limit !== false ? channel.prefetch(consumeOptions.limit || 500) : Promise.resolve())
      .then(() => {
        const handler = (raw) => {
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
        return channel.consume(channelName, handler, consumeOptions)
      }).then((result) => {
        channel.tag = result.consumerTag
        return result
      })
  }

  const unsubscribe = () => {
    if (channel.tag) {
      qLog.info(`Unsubscribing from queue ${channelName} with tag ${channel.tag}`)
      return channel.cancel(channel.tag)
    }
    return Promise.resolve()
  }

  const define = () => {
    if (options.check) {
      topLog.info(`Connecting to queue '${channelName}' on connection '${connectionName}'`)
      return channel.checkQueue(channelName)
    }
    let aqOptions = getAssertQueueOptions()
    topLog.info(`Declaring queue '${channelName}' on connection '${connectionName}'exchange with the options: ${JSON.stringify(aqOptions)}`)
    return channel.assertQueue(channelName, aqOptions)
  }

  const destroy = (released) => {
    let unresolvedCount = messages.messageCount()
    const flush = () => unresolvedCount > 0 && !released ? messages.flush() : Promise.resolve()

    function finalize () {
      messages.ignoreSignal()
      channel.destroy()
      channel = undefined
    }

    return flush().then(() => unsubscribe(channel, options)).then(finalize, finalize)
  }

  return {
    define,
    destroy,
    getMessageCount,
    subscribe,
    unsubscribe,
    purge,
    once: (...args) => channel.once(...args),
    tag: () => channel.tag
  }
}

module.exports = Queue
