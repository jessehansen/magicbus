// initial version from https://github.com/LeanKit-Labs/wascally

const Monologue = require('monologue.js')
const signal = require('postal').channel('rabbit.ack')
const { tick } = require('./util')

const calls = {
  ack: 'ack',
  nack: 'nack',
  reject: 'reject'
}

/**
 * Represents a message queue, used for batching ack/nack/reject calls
 * @private
 */
class AckBatch {
  /**
   * Creates a new AckBatch
   * @param {String} name - the name of the channel this batch is running on
   * @param {String} connectionName - the name of the connection this batch is running on
   * @param {Function} resolver - function with signature function(op, data). op will be a string,
          either 'waiting', 'ack', 'nack', or 'reject'
   * @param {Object} logger - the current logger. Will be namespaced with 'batch'
   */
  constructor (name, connectionName, resolver, logger) {
    this.name = name
    this.connectionName = connectionName
    this.lastAck = -1
    this.lastNack = -1
    this.lastReject = -1
    this.firstAck = undefined
    this.firstNack = undefined
    this.firstReject = undefined
    this.messages = []
    this.receivedCount = 0
    this.resolver = resolver
    this.logger = logger.withNamespace('batch')
  }

  /**
   * Add a message that will eventually be ack/nack/rejected
   * @public
   * @param {Object} message - the message to add
   */
  addMessage (message) {
    this.receivedCount++
    let status = message.message || message
    this.messages.push(status)
    this.logger.debug(`New pending tag ${status.tag} on queue ${this.name} - ${this.connectionName}`)
  }

  /**
   * Gets the first message with a specified status
   * @private
   * @param {String} status - desired status
   */
  firstByStatus (status) {
    return this.messages.find((x) => x.status === status)
  }

  /**
   * Removes all messages up to a given tag
   * @private
   * @param {Number} tag - message tag to remove up to
   */
  removeUpToTag (tag) {
    let removed = this.messages.filter((message) => message.tag <= tag)
    this.messages = this.messages.filter((message) => message.tag > tag)
    return removed
  }

  /**
   * Ack up to (and optionally including) the tag.
   * @private
   * @param {Number} tag - the tag
   */
  async ack (tag) {
    this.lastAck = tag
    await this.resolveTag(tag, 'ack')
  }

  /**
   * Nack up to (and optionally including) the tag.
   * @public
   * @param {Number} tag - the tag
   */
  async nack (tag) {
    this.lastNack = tag
    await this.resolveTag(tag, 'nack')
  }

  /**
   * Reject up to (and optionally including) the tag.
   * @public
   * @param {Number} tag - the tag
   */
  async reject (tag) {
    this.lastReject = tag
    await this.resolveTag(tag, 'reject')
  }

  /**
   * Updates instance properties after action has been executed for a given tag
   * @private
   * @param {Number} tag - the tag
   * @param {String} operation - which operation was executed (ack/nack/reject)
   */
  resolveTag (tag, operation) {
    let removed = this.removeUpToTag(tag)

    let nextAck = this.firstByStatus('ack')
    let nextNack = this.firstByStatus('nack')
    let nextReject = this.firstByStatus('reject')

    this.firstAck = nextAck ? nextAck.tag : undefined
    this.firstNack = nextNack ? nextNack.tag : undefined
    this.firstReject = nextReject ? nextReject.tag : undefined

    this.logger.debug(`${operation} ${removed.length} tags on ${this.name} - ${this.connectionName}. ` +
      `(Next ack: ${this.firstAck || 0}, Next nack: ${this.firstNack || 0}, Next reject: ${this.firstReject || 0})`)
    return this.resolver(operation, { tag, inclusive: true })
  }

  /**
   * Executes the first action in the queue
   * @private
   */
  async ackOrNackSequence () {
    try {
      let firstMessage = this.messages[0]
      if (firstMessage === undefined) {
        return false
      }
      let firstStatus = firstMessage.status
      let sequenceEnd = firstMessage.tag
      let call = calls[firstStatus]
      if (firstStatus === 'pending') {
        this.logger.silly('First message in batch pending, cannot process batch')
        return false
      }
      for (let i = 1; i < this.messages.length; i++) {
        if (this.messages[i].status !== firstStatus) {
          break
        }
        sequenceEnd = this.messages[i].tag
      }
      if (call) {
        await this[call](sequenceEnd)
      }
      return true
    } catch (err) {
      this.logger.error(`An exception occurred while trying to resolve ack/nack sequence '
        + 'on ${this.name} - ${this.connectionName}`, err)
      return false
    }
  }

  /**
   * Process a step in the message queue. This method is invoked when the ack signal is received
   * @private
   */
  async processBatch () {
    const count = this.messages.length
    if (this.acking) {
      return
    }
    this.acking = true
    this.logger.silly(`Ack/Nack/Reject - ${this.messages.length} messages`)
    if (count > 0) {
      // acks, nacks or rejects the next sequence, continue until it can go no further
      while (await this.ackOrNackSequence()) {}
      this.acking = false
    } else {
      // nothing to do
      this.acking = false
    }
    if (count > 0 && this.messages.length === 0) {
      this.logger.debug(`No pending tags remaining on queue ${this.name} - ${this.connectionName}`)
      // The following tick is the only thing between an insideous heisenbug and your sanity:
      // The promise for ack/nack will resolve on the channel before the server has processed it.
      // Without the tick, if there is a pending cleanup/shutdown on the channel from the queueFsm,
      // the channel close will complete and cause the server to ignore the outstanding ack/nack command.
      // I lost HOURS on this because doing things that slow down the processing of the close cause
      // the bug to disappear.
      // Hackfully yours,
      // Alex
      await tick()
      this.emit('empty')
    }
  }

  /**
   * Attempts to flush the queue of all resolved messages
   * @public
   * @returns {Promise} promise that is either resolved when the batch is empty or there are pending messages left
   */
  async flush () {
    this.logger.debug(`Flushing ack batch with ${this.messages.length} messages`)
    await this.processBatch()
    if (this.messages.length > 0) {
      this.logger.warn('!!! Cannot flush ack batch because some messages are pending !!!')
    }
    // see comment about heisenbug above. This gives amqplib enough time to actually resolve all messages
    await tick()
  }

  /**
   * Gets operation functions for a given message tag
   * @public
   * @param {Number} tag - message tag
   * @returns {Object} object containing message (message with tag and status),
        ack (function), nack (function), and reject (function) properties
   */
  getMessageOps (tag) {
    let message = {
      tag: tag,
      status: 'pending'
    }
    return {
      message: message,
      ack: () => {
        this.logger.silly(`Marking tag ${tag} as ack'd on queue ${this.name} - ${this.connectionName}`)
        this.firstAck = this.firstAck || tag
        message.status = 'ack'
      },
      nack: () => {
        this.logger.silly(`Marking tag ${tag} as nack'd on queue ${this.name} - ${this.connectionName}`)
        this.firstNack = this.firstNack || tag
        message.status = 'nack'
      },
      reject: () => {
        this.logger.silly(`Marking tag ${tag} as rejected on queue ${this.name} - ${this.connectionName}`)
        this.firstReject = this.firstReject || tag
        message.status = 'reject'
      }
    }
  }

  /**
   * Ignores the ack processing signal. Useful for shutdown or pausing message resolution
   * @public
   */
  ignoreSignal () {
    if (this.signalSubscription) {
      this.signalSubscription.unsubscribe()
    }
  };

  /**
   * Begin listening for the ack processing signal. Each signal will trigger a processBatch call
   * @public
   */
  listenForSignal () {
    if (!this.signalSubscription) {
      this.signalSubscription = signal.subscribe('#', () => {
        this.logger.silly('Received ack signal, processing ack batch')
        this.processBatch()
      })
    }
  };
}

Monologue.mixInto(AckBatch)

function CreateBatch (name, connectionName, resolver, logger) {
  return new AckBatch(name, connectionName, resolver, logger)
}

module.exports = CreateBatch
