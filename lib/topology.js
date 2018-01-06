const Monologue = require('monologue.js')

let ExchangeMachine
let QueueMachine

const getKeys = (keys) => {
  let actualKeys = ['']
  if (keys && keys.length > 0) {
    actualKeys = Array.isArray(keys) ? keys : [keys]
  }
  return actualKeys
}

const toArray = (x, list) => {
  if (Array.isArray(x)) {
    return x
  }
  if (typeof x === 'object' && list) {
    return Object.values(x)
  }
  if (x === undefined || x === null) {
    return []
  }
  return [x]
}

/**
 * Represents a set of related queues, exchanges, bindings, etc. Supports
 * rebuilding topology upon (re)connection to rabbitmq
 */
class Topology {
  /**
   * Creates a topology instance
   * @param {Connection} connection - the connection state machine
   * @param {Object} logger - the logger
   */
  constructor (connection, logger) {
    this.connection = connection
    this.channels = {}
    this.promises = {}
    this.definitions = {
      bindings: {},
      exchanges: {},
      queues: {}
    }
    this.logger = logger

    connection.on('reconnected', () => {
      this.onReconnect()
    })
  }

  /**
   * Configures multiple bindings
   *
   * @public
   * @param {Object|Array} bindings - bindings to create.
   * @param {bool} list - true if bindings is an object with each value representing a binding
   * @returns {Promise} a promise that is fulfilled when all of the bindings have been created
   */
  configureBindings (bindings, list) {
    let actualDefinitions = toArray(bindings, list)
    let promises = actualDefinitions.map((def) => this.createBinding(
      {
        source: def.exchange || def.source,
        target: def.target,
        keys: def.keys,
        queue: def.queue === true || def.target in this.definitions.queues
      }))
    return Promise.all(promises)
  }

  /**
   * Configures multiple queues
   *
   * @public
   * @param {Object|Array} queues - queues to create.
   * @param {bool} list - true if queues is an object with each value representing a queue
   * @returns {Promise} a promise that is fulfilled when all of the queues have been created
   */
  configureQueues (queues, list) {
    let actualDefinitions = toArray(queues, list)
    let promises = actualDefinitions.map((def) => this.createQueue(def))
    return Promise.all(promises)
  }

  /**
   * Configures multiple exchanges
   *
   * @public
   * @param {Object|Array} exchanges - exchanges to create.
   * @param {bool} list - true if exchanges is an object with each value representing an exchange
   * @returns {Promise} a promise that is fulfilled when all of the exchanges have been created
   */
  configureExchanges (exchanges, list) {
    let actualDefinitions = toArray(exchanges, list)
    let promises = actualDefinitions.map((def) => this.createExchange(def))
    return Promise.all(promises)
  }

  /**
   * Create a binding from an exchange to an exchange or a queue
   *
   * @public
   * @param {Object} options - details of the binding
   * @param {String} options.source - name of the source exchange
   * @param {String} options.target - name of the target exchange or queue
   * @param {bool} options.queue - true if options.target is a queue
   * @param {Array|string} options.keys - routing key pattern(s) that should be bound
   * @returns {Promise} a promise that is fulfilled when the binding has been created
   */
  createBinding (options) {
    let id = [options.source, options.target].join('->')
    let promise = this.promises[id]
    if (!promise) {
      this.definitions.bindings[id] = options
      let call = options.queue ? 'bindQueue' : 'bindExchange'
      let source = options.source
      let target = options.target
      let keys = getKeys(options.keys)
      let channel = this.getChannel('control')
      this.logger.verbose(`Binding '${target}' to '${source}' on '${this.connection.name}'` +
        ` with keys: ${JSON.stringify(keys)}`)
      this.promises[id] = promise = Promise.all(keys.map((key) => channel[call](target, source, key)))
    }
    return promise
  }

  /**
   * Create a queue or exchange
   *
   * @private
   * @param {Function} Primitive - Queue or Exchange state machine factory function
   * @param {String} primitiveType - exchange or queue
   * @param {Object} options - details for the object, passed along to Primitive constructor,
        which may take additional options.
   * @param {String} options.name - name of the exchange or queue
   * @returns {Promise} a promise that is fulfilled when the primitive has been created
   */
  createPrimitive (Primitive, primitiveType, options) {
    let errorFn = (err) => new Error(`Failed to create ${primitiveType} '${options.name}' on connection ` +
      `'${this.connection.name}' with '${err ? (err.message || err) : 'N/A'}'`)
    let definitions = primitiveType === 'exchange' ? this.definitions.exchanges : this.definitions.queues
    let channelName = [primitiveType, options.name].join(':')
    let promise = this.promises[channelName]
    if (!promise) {
      this.promises[channelName] = promise = new Promise((resolve, reject) => {
        definitions[options.name] = options
        let primitive = this.channels[channelName] = Primitive(options, this.connection, this, this.logger)
        let onConnectionFailed = (connectionError) => {
          reject(errorFn(connectionError))
        }
        if (this.connection.state === 'failed') {
          onConnectionFailed(this.connection.lastError())
        } else {
          let onFailed = this.connection.on('failed', (err) => {
            onConnectionFailed(err)
          })
          primitive.once('defined', () => {
            onFailed.unsubscribe()
            resolve(primitive)
          })
        }
        primitive.once('failed', (err) => {
          delete definitions[options.name]
          delete this.channels[channelName]
          reject(errorFn(err))
        })
      })
    }
    return promise
  }

  /**
   * Create an exchange. Adds a channel exchange:[name]
   *
   * @public
   * @param {Object} options - details for the exchange, passed along to ExchangeMachine constructor,
        which may take additional options.
   * @param {String} options.name - exchange name
   * @param {String} options.type - exchange type (fanout, headers, topic, direct)
   * @param {bool} options.durable - if true, the exchange will survive broker restarts. Defaults to true.
   * @param {bool} options.internal - if true, messages cannot be published directly to the exchange
        (i.e., it can only be the target of bindings, or possibly create messages ex-nihilo). Defaults to false.
   * @param {bool} options.autoDelete - if true, the exchange will be destroyed once the number of bindings
        for which it is the source drop to zero. Defaults to false.
   * @param {String} options.alternateExchange - an exchange to send messages to if this exchange can't
        route them to any queues. Alias: options.alternate
   * @param {Object} options.arguments - any additional arguments that may be needed by an exchange type.
   * @param {String} options.publishTimeout - how long to wait before timing out a publish
        (defaults to 0, or indefinite)
   * @returns {Promise} a promise that is fulfilled when the exchange has been created
   */
  createExchange (options) {
    return this.createPrimitive(ExchangeMachine, 'exchange', options)
  }

  /**
   * Create a queue. Adds a channel queue:[name]
   *
   * @public
   * @param {Object} options - details in creating the queue - passed to amqplib's assertExchange function
   * @param {String} options.name - queue name
   * @param {Number} options.limit - the channel prefetch limit
   * @param {bool} options.noBatch - if true, ack/nack/reject operations will execute immediately and not be batched
   * @param {bool} options.noAck - if true, do not ack messages on the queue, only nack or reject. Passed to
        channel.consume
   * @param {bool} options.exclusive - if true, scopes the queue to the connection (defaults to false)
   * @param {bool} options.durable - if true, the queue will survive broker restarts, modulo the effects of
        exclusive and autoDelete; this defaults to true if not supplied, unlike the others
   * @param {bool} options.autoDelete - if true, the queue will be deleted when the number of consumers drops
        to zero (defaults to false)
   * @param {Number} options.messageTtl (0 <= n < 2^32): expires messages arriving in the queue after n milliseconds
   * @param {Number} options.expires (0 < n < 2^32): the queue will be destroyed after n milliseconds of disuse,
        where use means having consumers, being declared (asserted or checked, in this API), or being polled
        with a #get.
   * @param {String} options.deadLetterExchange - an exchange to which messages discarded from the queue will be
        resent. Use deadLetterRoutingKey to set a routing key for discarded messages; otherwise, the message's routing
        key (and CC and BCC, if present) will be preserved. A message is discarded when it expires or is rejected or
        nacked, or the queue limit is reached. Aliased as options.deadLetter
   * @param {String} options.deadLetterRoutingKey - routing key to set on discarded messages. Ignored if
        deadLetterExchange is not also set
   * @param {Number} options.maxLength - sets a maximum number of messages the queue will hold. Old messages will be
        discarded (dead-lettered if that's set) to make way for new messages. Aliased as options.queueLimit
   * @param {Number} options.maxPriority -  makes the queue a priority queue.
   * @param {Object} options.arguments - additional arguments, usually parameters for some kind of broker-specific
        extension e.g., high availability, TTL.
   * @returns {Promise} a promise that is fulfilled when the queue has been created
   */
  createQueue (options) {
    return this.createPrimitive(QueueMachine, 'queue', options)
  }

  /**

   * Delete an exchange
   *
   * @public
   * @param {String} name - exchange name
   * @returns {Promise} a promise that is fulfilled when the exchange has been deleted
   */
  deleteExchange (name) {
    let key = 'exchange:' + name
    let channel = this.channels[key]
    if (channel) {
      channel.destroy()
      delete this.channels[key]
      this.logger.verbose(`Deleting ${channel.type} exchange '${name}' on connection '${this.connection.name}'`)
    }
    let control = this.getChannel('control')
    return control.deleteExchange(name)
  }

  /**
   * Delete a queue
   *
   * @public
   * @param {String} name - queue name
   * @returns {Promise} a promise that is fulfilled when the queue has been deleted
   */
  deleteQueue (name) {
    let key = 'queue:' + name
    let channel = this.channels[key]
    if (channel) {
      channel.destroy()
      delete this.channels[key]
      this.logger.verbose(`Deleting queue '${name}' on connection '${this.connection.name}'`)
    }
    let control = this.getChannel('control')
    return control.deleteQueue(name)
  }

  /**
   * Get a channel by its name. Creates a channel if one does not exist.
   *
   * @public
   * @param {String} name - channel name
   * @returns {Channel} a channel
   */
  getChannel (name) {
    let channel = this.channels[name]
    if (!channel) {
      channel = this.connection.createChannel(false)
      this.channels[name] = channel
    }
    return channel
  }

  /**
   * Connection reconnected event handler. Reopens channels and recreates bindings
   *
   * @private
   */
  onReconnect () {
    this.logger.verbose(`Reconnection to '${this.connection.name}' established - rebuilding topology`)
    this.promises = {}
    let prerequisites = Object.values(this.channels)
      .map((channel) => channel.check ? channel.check() : Promise.resolve(true))
    Promise.all(prerequisites)
      .then(() => {
        this.configureBindings(this.definitions.bindings, true)
          .then(() => {
            this.logger.verbose(`Topology rebuilt for connection '${this.connection.name}'`)
            this.emit('bindings-completed')
          })
      })
  }

  /**
   * Resets topology, removing all channels, definitions, and bindings. Also resets connection
   *
   * @public
   */
  reset () {
    Object.values(this.channels).forEach((channel) => {
      if (channel.destroy) {
        channel.destroy()
      }
    })
    this.channels = {}
    this.connection.reset()
    this.definitions = {
      bindings: {},
      exchanges: {},
      queues: {}
    }
  }
}

Monologue.mixInto(Topology)

/**
 * Topology factory function
 *
 * @public
 * @param {Connection} connection - the connection state machine
 * @param {Object} logger - the logger
 * @param {Object} exchangeMachine - the ExchangeMachine class, allows overriding the default implementation
 * @param {Object} queueMachine - the QueueMachine class, allows overriding the default implementation
 */
module.exports = function CreateTopology (connection, log, exchangeMachine, queueMachine) {
  ExchangeMachine = exchangeMachine || require('./exchange-machine')
  QueueMachine = queueMachine || require('./queue-machine')

  return new Topology(connection, log)
}
