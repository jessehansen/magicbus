const DefaultConsumerTopology = ({
  serviceDomainName,
  appName,
  routeName,
  topology,
  noAck = false,
  durable = true,
  autoDelete = false,
  exclusive = false
}) => async (ctx, next) => {
  let baseName = serviceDomainName + '.' + appName + '.' + routeName
  let failedName = baseName + '.failed'

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
  await topology.createQueue({
    name: baseName,
    deadLetter: failedName,
    noAck: noAck,
    durable,
    autoDelete,
    exclusive
  })
  ctx.queue = baseName
  ctx.failedQueue = failedName
  await next(ctx)
}

module.exports = DefaultConsumerTopology
