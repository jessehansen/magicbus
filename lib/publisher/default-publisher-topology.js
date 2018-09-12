const DefaultPublisherTopology = ({
  serviceDomainName,
  appName,
  routeName,
  topology,
  exchangeType,
  durable,
  autoDelete
}) => {
  const filter = async (ctx, next) => {
    let exchangeName = serviceDomainName + '.' + appName + '.' + routeName

    await topology.createExchange({
      name: exchangeName,
      type: exchangeType,
      durable,
      autoDelete
    })

    ctx.exchange = exchangeName
    await next(ctx)
  }

  filter.inspect = () => ({
    type: 'Default Publisher Topology',
    serviceDomainName,
    appName,
    routeName,
    exchangeType,
    durable,
    autoDelete
  })

  return filter
}

module.exports = DefaultPublisherTopology
