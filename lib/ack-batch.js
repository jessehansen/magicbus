// initial version from https://github.com/LeanKit-Labs/wascally

const _ = require('lodash')
const Monologue = require('monologue.js')
const signal = require('postal').channel('rabbit.ack')
const Promise = require('bluebird')

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
    return _.find(this.messages, { status: status })
  }

  /**
   * Gets the last message with a specified status
   * @private
   * @param {String} status - desired status
   */
  lastByStatus (status) {
    return _.findLast(this.messages, { status: status })
  }

  /**
   * Removes all messages with a given status
   * @private
   * @param {String} status - status to remove
   */
  removeByStatus (status) {
    return _.remove(this.messages, (message) => message.status === status)
  }

  /**
   * Removes all messages up to a given tag
   * @private
   * @param {Number} tag - message tag to remove up to
   */
  removeUpToTag (tag) {
    return _.remove(this.messages, (message) => message.tag <= tag)
  }

  /**
   * Ack up to (and optionally including) the tag.
   * @private
   * @param {Number} tag - the tag
   * @param {bool} inclusive - whether the ack should include tag
   */
  ack (tag, inclusive) {
    this.lastAck = tag
    this.resolveTag(tag, 'ack', inclusive)
  }

  /**
   * Nack up to (and optionally including) the tag.
   * @public
   * @param {Number} tag - the tag
   * @param {bool} inclusive - whether the nack should include tag
   */
  nack (tag, inclusive) {
    this.lastNack = tag
    this.resolveTag(tag, 'nack', inclusive)
  }

  /**
   * Reject up to (and optionally including) the tag.
   * @public
   * @param {Number} tag - the tag
   * @param {bool} inclusive - whether the reject should include tag
   */
  reject (tag, inclusive) {
    this.lastReject = tag
    this.resolveTag(tag, 'reject', inclusive)
  }

  /**
   * Updates instance properties after action has been executed for a given tag
   * @private
   * @param {Number} tag - the tag
   * @param {String} operation - which operation was executed (ack/nack/reject)
   * @param {bool} inclusive - whether the operation included tag
   */
  resolveTag (tag, operation, inclusive) {
    let removed = this.removeUpToTag(tag)

    let nextAck = this.firstByStatus('ack')
    let nextNack = this.firstByStatus('nack')
    let nextReject = this.firstByStatus('reject')

    this.firstAck = nextAck ? nextAck.tag : undefined
    this.firstNack = nextNack ? nextNack.tag : undefined
    this.firstReject = nextReject ? nextReject.tag : undefined

    this.logger.debug(`${operation} ${removed.length} tags (${inclusive ? 'inclusive' : 'individual'}) on ${this.name} - ${this.connectionName}. (Next ack: ${this.firstAck || 0}, Next nack: ${this.firstNack || 0}, Next reject: ${this.firstReject || 0})`)
    this.resolver(operation, { tag: tag, inclusive: inclusive })
  }

  /**
   * Executes the first action in the queue
   * @private
   */
  ackOrNackSequence () {
    try {
      let firstMessage = this.messages[0]
      if (firstMessage === undefined) {
        return
      }
      let firstStatus = firstMessage.status
      let sequenceEnd = firstMessage.tag
      let call = calls[firstStatus]
      if (firstStatus === 'pending') {
        this.logger.silly('First message in batch pending, cannot process batch')
        return
      }
      for (let i = 1; i < _.size(this.messages) - 1; i++) {
        if (this.messages[i].status !== firstStatus) {
          break
        }
        sequenceEnd = this.messages[i].tag
      }
      if (call) {
        this[call](sequenceEnd, true)
      }
    } catch (err) {
      this.logger.error(`An exception occurred while trying to resolve ack/nack sequence '
        + 'on ${this.name} - ${this.connectionName}`, err)
    }
  }

  /**
   * Process a step in the message queue. This method is invoked when the ack signal is received
   * @private
   */
  processBatch () {
    this.acking = this.acking !== undefined ? this.acking : false
    if (!this.acking) {
      this.acking = true
      this.logger.silly(`Ack/Nack/Reject - ${this.messages.length} messages`)
      let hasPending = (_.findIndex(this.messages, { status: 'pending' }) >= 0)
      let hasAck = this.firstAck
      let hasNack = this.firstNack
      let hasReject = this.firstReject

      this.logger.silly(`Pending: ${hasPending}, Ack: ${hasAck}, Nack: ${hasNack}, Reject: ${hasReject}`)
      if (!hasPending && !hasNack && hasAck && !hasReject) {
        // just acks
        this.resolveAll('ack', 'firstAck', 'lastAck')
      } else if (!hasPending && hasNack && !hasAck && !hasReject) {
        // just nacks
        this.resolveAll('nack', 'firstNack', 'lastNack')
      } else if (!hasPending && !hasNack && !hasAck && hasReject) {
        // just rejects
        this.resolveAll('reject', 'firstReject', 'lastReject')
      } else if (hasNack || hasAck || hasReject) {
        // acks, nacks or rejects
        this.ackOrNackSequence()
        this.acking = false
      } else {
        // nothing to do
        this.resolver('waiting')
        this.acking = false
      }
    }
  }

  /**
   * Resolves all messages of a given status
   * @private
   * @param {String} status - status to resolve
   * @param {String} first - name of the instance property containing the first tag, ex: 'firstAck'
   * @param {String} last - name of the instance property containing the last tag, ex: 'lastAck'
   */
  resolveAll (status, first, last) {
    const count = this.messages.length
    const emitEmpty = () => {
      setTimeout(() => {
        this.emit('empty')
      }, 0)
    }
    if (this.messages.length !== 0) {
      let lastTag = this.lastByStatus(status).tag
      this.logger.debug(`${status} ALL (${this.messages.length}) tags on ${this.name} - ${this.connectionName}.`)
      this.resolver(status, { tag: lastTag, inclusive: true })
        .then(() => {
          this[last] = lastTag
          this.removeByStatus(status)
          this[first] = undefined
          if (count > 0 && this.messages.length === 0) {
            this.logger.debug(`No pending tags remaining on queue ${this.name} - ${this.connectionName}`)
            // The following setTimeout is the only thing between an insideous heisenbug and your sanity:
            // The promise for ack/nack will resolve on the channel before the server has processed it.
            // Without the setTimeout, if there is a pending cleanup/shutdown on the channel from the queueFsm,
            // the channel close will complete and cause the server to ignore the outstanding ack/nack command.
            // I lost HOURS on this because doing things that slow down the processing of the close cause
            // the bug to disappear.
            // Hackfully yours,
            // Alex
            emitEmpty()
          }
          this.acking = false
        })
    }
  }

  /**
   * Attempts to flush the queue of all resolved messages
   * @public
   * @returns {Promise} promise that is either resolved when the batch is empty or there are pending messages left
   */
  flush () {
    this.logger.debug(`Flushing ack batch with ${this.messages.length} messages`)
    const step = () => {
      let firstMessage = this.messages[0]
      if (firstMessage === undefined) {
        return Promise.resolve()
      }
      if (firstMessage.status === 'pending') {
        this.logger.warn('!!! Cannot flush ack batch because some messages are pending !!!')
        return Promise.resolve()
      }

      this.processBatch()
      // see comment about heisenbug above. This gives amqplib enough time to actually resolve all messages
      return Promise.delay(0)
        .then(() => {
          if (this.messages.length > 0) {
            return step()
          }
          this.logger.debug('Ack batch is empty')
          return Promise.resolve()
        })
    }
    return step()
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
