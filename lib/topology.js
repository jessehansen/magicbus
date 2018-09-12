const assert = require('assert')
const Monologue = require('monologue.js')

const getKeys = (keys) => {
  let actualKeys = ['']
  if (keys && keys.length > 0) {
    actualKeys = Array.isArray(keys) ? keys : [keys]
  }
  return actualKeys
}

const Topology = (connection, logger, exchangeMachineFactory, queueMachineFactory) => {
  const ExchangeMachine = exchangeMachineFactory || require('./exchange-machine')
  const QueueMachine = queueMachineFactory || require('./queue-machine')

  let channels = {}
  let promises = {}
  let bindings = {}
  let events = new Monologue()
  const topology = {}

  const channel = (name) => channels[name] || assert.fail(`No channel ${name}`)

  const getOrCreateChannel = (name) => {
    let channel = channels[name]
    if (!channel) {
      channel = connection.createChannel(false)
      channels[name] = channel
    }
    return channel
  }

  const createPrimitive = (Primitive, primitiveType, options) => {
    let errorFn = (err) => new Error(`Failed to create ${primitiveType} '${options.name}' on connection exchange'${connection.name}' with '${err ? (err.message || err) : 'N/A'}'`)

    let channelName = `${primitiveType}:${options.name}`
    let promise = promises[channelName]
    if (!promise) {
      promises[channelName] = promise = new Promise((resolve, reject) => {
        let primitive = channels[channelName] = Primitive(options, connection, topology, logger)
        let onConnectionFailed = (connectionError) => {
          reject(errorFn(connectionError))
        }
        if (connection.state === 'failed') {
          onConnectionFailed(connection.lastError())
        } else {
          let onFailed = connection.on('failed', (err) => {
            onConnectionFailed(err)
          })
          primitive.once('defined', () => {
            onFailed.unsubscribe()
            resolve(primitive)
          })
        }
        primitive.once('failed', (err) => {
          delete channels[channelName]
          reject(errorFn(err))
        })
      })
    }
    return promise
  }

  const createBinding = ({ source, target, queue, keys }) => {
    let id = `${source}->${target}`
    let promise = promises[id]
    if (!promise) {
      keys = getKeys(keys)
      bindings[id] = { source, target, queue, keys }
      let call = queue ? 'bindQueue' : 'bindExchange'
      let channel = getOrCreateChannel('control')
      logger.verbose(`Binding '${target}' to '${source}' on '${connection.name}'exchange with keys: ${JSON.stringify(keys)}`)
      promises[id] = promise = Promise.all(keys.map((key) => channel[call](target, source, key)))
    }
    return promise
  }

  const configureBindings = async (bindings) => {
    let actualDefinitions = Object.values(bindings)
    await actualDefinitions.map(({ source, target, queue, keys }) =>
      createBinding({ source, target, queue, keys }))
  }

  connection.on('reconnected', async () => {
    logger.verbose(`Reconnection to '${connection.name}' established - rebuilding topology`)
    promises = {}
    await Promise.all(Object.values(channels)
      .map((c) => typeof c.check === 'function' ? c.check() : Promise.resolve(true)))

    // Exchanges and queues manage their own lifetimes, but bindings do not.
    // Handle that here
    await configureBindings(bindings)

    logger.verbose(`Topology rebuilt for connection '${connection.name}'`)
    events.emit('bindings-completed')
  })

  Object.assign(topology, {
    channel,
    getOrCreateChannel, /* probably shouldn't be public */

    createExchange: (options) => createPrimitive(ExchangeMachine, 'exchange', options),
    connectExchange: (name) => createPrimitive(ExchangeMachine, 'exchange', { name, check: true }),
    deleteExchange: (name) => {
      let key = 'exchange:' + name
      let channel = channels[key]
      if (channel) {
        channel.destroy()
        delete channels[key]
        logger.verbose(`Deleting ${channel.type} exchange '${name}' on connection '${connection.name}'`)
      }
      let control = getOrCreateChannel('control')
      return control.deleteExchange(name)
    },

    createQueue: (options) => createPrimitive(QueueMachine, 'queue', options),
    connectQueue: (name) => createPrimitive(QueueMachine, 'queue', { name, check: true }),
    deleteQueue: (name) => {
      let key = 'queue:' + name
      let channel = channels[key]
      if (channel) {
        channel.destroy()
        delete channels[key]
        logger.verbose(`Deleting queue '${name}' on connection '${connection.name}'`)
      }
      let control = getOrCreateChannel('control')
      return control.deleteQueue(name)
    },

    createBinding,

    close: () => connection.close(true),
    reset: () => {
      Object.values(channels).forEach((channel) => {
        if (channel.destroy) {
          channel.destroy()
        }
      })
      channels = {}
      connection.reset()
      bindings = {}
    },

    on: (...args) => events.on(...args)
  })

  return topology
}

module.exports = Topology
