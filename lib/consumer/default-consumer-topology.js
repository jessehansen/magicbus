const DefaultConsumerTopology = ({
  serviceDomainName,
  appName,
  routeName,
  topology,
  noAck,
  durable,
  autoDelete,
  exclusive,
  failureQueue
}) => {
  const filter = async (ctx, next) => {
    let baseName = serviceDomainName + '.' + appName + '.' + routeName
    let failedName = baseName + '.failed'

    if (failureQueue) {
      await topology.createExchange({
        name: failedName,
        type: 'fanout',
        durable,
        autoDelete
      })
      await topology.createQueue({
        name: failedName,
        noAck,
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
      name: baseName,
      deadLetter: failureQueue ? failedName : undefined,
      noAck,
      durable,
      autoDelete,
      exclusive
    })
    ctx.queue = baseName
    await next(ctx)
  }
  filter.inspect = () => ({
    type: 'Default Consumer Topology',
    serviceDomainName,
    appName,
    routeName,
    noAck,
    durable,
    autoDelete,
    exclusive,
    failureQueue
  })
  return filter
}

module.exports = DefaultConsumerTopology
