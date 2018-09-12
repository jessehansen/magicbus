const shortid = require('shortid')

const ListenerConsumerTopology = ({
  serviceDomainName,
  appName,
  routeName,
  topology,
  noAck,
  durable,
  autoDelete,
  failureQueue,
  failureQueueExclusive
}) => {
  const filter = async (ctx, next) => {
    let baseName = `${serviceDomainName}.${appName}.${routeName}`
    let randomListenerName = `${baseName}.listener-${shortid.generate()}`
    let failedName = `${baseName}.failed`

    await topology.createExchange({
      name: baseName,
      type: 'fanout',
      durable,
      autoDelete
    })
    if (failureQueue) {
      await topology.createExchange({
        name: failedName,
        type: 'fanout',
        durable,
        autoDelete
      })
      await topology.createQueue({
        name: failedName,
        durable,
        autoDelete,
        exclusive: failureQueueExclusive
      })
      await topology.createBinding({
        source: failedName,
        target: failedName,
        queue: true
      })
      ctx.failedQueue = failedName
    }
    await topology.createQueue({
      name: randomListenerName,
      deadLetter: failureQueue ? failedName : undefined,
      noAck: noAck,
      durable,
      autoDelete,
      exclusive: true
    })
    await topology.createBinding({
      source: baseName,
      target: randomListenerName,
      queue: true
    })
    ctx.exchange = baseName
    ctx.queue = randomListenerName
    await next(ctx)
  }
  filter.inspect = () => ({
    type: 'Listener Consumer Topology',
    serviceDomainName,
    appName,
    routeName,
    noAck,
    durable,
    autoDelete,
    failureQueueExclusive,
    failureQueue
  })
  return filter
}

module.exports = ListenerConsumerTopology
