const PublisherTopologyFilter = ({
  serviceDomainName,
  appName,
  routeName,
  topology,
  exchangeType = 'topic',
  durable = true,
  autoDelete = false
}) =>
  async (ctx, next) => {
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

module.exports = PublisherTopologyFilter
