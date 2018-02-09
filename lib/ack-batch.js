// initial version from https://github.com/LeanKit-Labs/wascally
const signal = require('postal').channel('rabbit.ack')
const { tick } = require('./util')

const AckBatch = (name, connectionName, resolver, l) => {
  let acking = false
  let firstAck
  let firstNack
  let firstReject
  let signalSubscription
  let messages = []
  let receivedCount = 0
  let logger = l.withNamespace('batch')

  const addMessage = (message) => {
    receivedCount++
    let status = message.message || message
    messages.push(status)
    logger.debug(`New pending tag ${status.tag} on queue ${name} - ${connectionName}`)
  }

  const firstByStatus = (status) => messages.find((x) => x.status === status)

  const removeUpToTag = (tag) => {
    let removed = messages.filter((message) => message.tag <= tag)
    messages = messages.filter((message) => message.tag > tag)
    return removed
  }

  const resolveTag = (tag, operation) => {
    let removed = removeUpToTag(tag)

    let nextAck = firstByStatus('ack')
    let nextNack = firstByStatus('nack')
    let nextReject = firstByStatus('reject')

    firstAck = nextAck ? nextAck.tag : undefined
    firstNack = nextNack ? nextNack.tag : undefined
    firstReject = nextReject ? nextReject.tag : undefined

    logger.debug(`${operation} ${removed.length} tags on ${name} - ${connectionName}. (Next ack: ${firstAck || 0}, Next nack: ${firstNack || 0}, Next reject: ${firstReject || 0})`)
    return resolver(operation, { tag, inclusive: true })
  }

  const ackOrNackSequence = async () => {
    try {
      let firstMessage = messages[0]
      if (firstMessage === undefined) {
        return false
      }
      let firstStatus = firstMessage.status
      let sequenceEnd = firstMessage.tag
      if (firstStatus === 'pending') {
        logger.silly('First message in batch pending, cannot process batch')
        return false
      }
      for (let i = 1; i < messages.length; i++) {
        if (messages[i].status !== firstStatus) {
          break
        }
        sequenceEnd = messages[i].tag
      }
      await resolveTag(sequenceEnd, firstStatus)
      return true
    } catch (err) {
      logger.error(`An exception occurred while trying to resolve ack/nack sequence '
        + 'on ${name} - ${connectionName}`, err)
      return false
    }
  }

  const processBatch = async () => {
    const count = messages.length
    if (acking) {
      return
    }
    acking = true
    logger.silly(`Ack/Nack/Reject - ${messages.length} messages`)
    if (count > 0) {
      // acks, nacks or rejects the next sequence, continue until it can go no further
      while (await ackOrNackSequence()) {}
      if (messages.length === 0) {
        logger.debug(`No pending tags remaining on queue ${name} - ${connectionName}`)
      }
    }
    acking = false
  }

  const flush = async () => {
    logger.debug(`Flushing ack batch with ${messages.length} messages`)
    await processBatch()
    if (messages.length > 0) {
      logger.warn('!!! Cannot flush ack batch because some messages are pending !!!')
    }
    // This gives amqplib enough time to actually resolve all messages
    await tick()
  }

  const getMessageOps = (tag) => {
    let message = {
      tag: tag,
      status: 'pending'
    }
    return {
      message: message,
      ack: () => {
        logger.silly(`Marking tag ${tag} as ack'd on queue ${name} - ${connectionName}`)
        firstAck = firstAck || tag
        message.status = 'ack'
      },
      nack: () => {
        logger.silly(`Marking tag ${tag} as nack'd on queue ${name} - ${connectionName}`)
        firstNack = firstNack || tag
        message.status = 'nack'
      },
      reject: () => {
        logger.silly(`Marking tag ${tag} as rejected on queue ${name} - ${connectionName}`)
        firstReject = firstReject || tag
        message.status = 'reject'
      }
    }
  }

  const listenForSignal = () => {
    if (!signalSubscription) {
      signalSubscription = signal.subscribe('#', () => {
        logger.silly('Received ack signal, processing ack batch')
        processBatch()
      })
    }
  }
  const ignoreSignal = () => {
    if (signalSubscription) {
      signalSubscription.unsubscribe()
    }
  }

  return {
    name,
    connectionName,
    messageCount: () => messages.length,
    receivedCount: () => receivedCount,
    incrementReceived: () => receivedCount++,
    addMessage,
    getMessageOps,
    listenForSignal,
    ignoreSignal,
    flush
  }
}

module.exports = AckBatch
