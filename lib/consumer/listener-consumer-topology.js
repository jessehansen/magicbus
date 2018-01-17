const shortid = require('shortid')

const ListenerConsumerTopology = ({
  serviceDomainName,
  appName,
  routeName,
  topology,
  noAck = false,
  durable = true,
  autoDelete = false,
  exclusive = false,
  failureQueue = true
}) => async (ctx, next) => {
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
      exclusive
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
  ctx.exchange = baseName
  ctx.queue = randomListenerName
  await next(ctx)
}

module.exports = ListenerConsumerTopology
