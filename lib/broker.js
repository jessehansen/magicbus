const signal = require('postal').channel('rabbit.ack')

const Broker = (serviceDomainName, appName, topology, logger) => {
  let closed = false
  let ackInterval = null

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

  const publish = ({ exchange, routingKey = '', content, options }) => {
    let x = getExchange(exchange)
    logger.debug(`Publishing message to exchange ${x.name} with routing key '${routingKey}'`)
    return x.publish({ routingKey, content, options })
  }

  const consume = ({ queue, options }, callback) => {
    let q = getQueue(queue)
    logger.debug(`Beginning consumption from queue ${q.name}`)
    return q.subscribe(callback, options).then(/* strip result from promise */)
  }

  const purgeQueue = (queue) =>
    getQueue(queue).purge()

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
    return topology.connection.close(true).then(() => {
      topology = null
    })
  }

  const getTopologyParams = () => ({
    serviceDomainName,
    appName,
    topology
  })

  const isConnected = () => !closed

  const bind = async (bindSource, bindTarget, { queue = true, pattern = '' } = {}) => {
    let source = bindSource
    let target = bindTarget
    if (typeof bindSource.getBindingSource === 'function') {
      source = (await bindSource.getBindingSource()).name
    }
    if (typeof bindTarget.getBindingTarget === 'function') {
      let t = await bindTarget.getBindingTarget()
      target = t.name
      queue = t.queue
    }
    logger.info(`Binding "${source}" exchange to "${target}" (${queue ? 'queue' : 'exchange'}) with pattern "${pattern}"`)
    await topology.createBinding({
      source,
      target,
      queue,
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

module.exports = Broker
