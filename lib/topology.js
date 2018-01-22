const assert = require('assert')
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

class Topology {
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

  channel (name) {
    this.channels[name] || assert.fail(`No channel ${name}`)
    return this.channels[name]
  }

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

  createBinding (options) {
    let id = [options.source, options.target].join('->')
    let promise = this.promises[id]
    if (!promise) {
      this.definitions.bindings[id] = options
      let call = options.queue ? 'bindQueue' : 'bindExchange'
      let source = options.source
      let target = options.target
      let keys = getKeys(options.keys)
      let channel = this.getOrCreateChannel('control')
      this.logger.verbose(`Binding '${target}' to '${source}' on '${this.connection.name}'` +
        ` with keys: ${JSON.stringify(keys)}`)
      this.promises[id] = promise = Promise.all(keys.map((key) => channel[call](target, source, key)))
    }
    return promise
  }

  createPrimitive (Primitive, primitiveType, options) {
    let errorFn = (err) => new Error(`Failed to create ${primitiveType} '${options.name}' on connection ` +
      `'${this.connection.name}' with '${err ? (err.message || err) : 'N/A'}'`)

    let definitions = primitiveType === 'exchange' ? this.definitions.exchanges : this.definitions.queues
    let channelName = `${primitiveType}:${options.name}`
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

  createExchange (options) {
    return this.createPrimitive(ExchangeMachine, 'exchange', options)
  }

  connectExchange (name) {
    return this.createPrimitive(ExchangeMachine, 'exchange', { name, check: true })
  }

  createQueue (options) {
    return this.createPrimitive(QueueMachine, 'queue', options)
  }

  connectQueue (name) {
    return this.createPrimitive(QueueMachine, 'queue', { name, check: true })
  }

  deleteExchange (name) {
    let key = 'exchange:' + name
    let channel = this.channels[key]
    if (channel) {
      channel.destroy()
      delete this.channels[key]
      this.logger.verbose(`Deleting ${channel.type} exchange '${name}' on connection '${this.connection.name}'`)
    }
    let control = this.getOrCreateChannel('control')
    return control.deleteExchange(name)
  }

  deleteQueue (name) {
    let key = 'queue:' + name
    let channel = this.channels[key]
    if (channel) {
      channel.destroy()
      delete this.channels[key]
      this.logger.verbose(`Deleting queue '${name}' on connection '${this.connection.name}'`)
    }
    let control = this.getOrCreateChannel('control')
    return control.deleteQueue(name)
  }

  getOrCreateChannel (name) {
    let channel = this.channels[name]
    if (!channel) {
      channel = this.connection.createChannel(false)
      this.channels[name] = channel
    }
    return channel
  }

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
