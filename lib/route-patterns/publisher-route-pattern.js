const publisherRoutePattern = ({ exchangeType = 'topic', durable = true, autoDelete = false } = {}) =>
  (topology, serviceDomainName, appName, routeName) => {
    let exchangeName = serviceDomainName + '.' + appName + '.' + routeName

    return topology.createExchange({
      name: exchangeName,
      type: exchangeType,
      durable,
      autoDelete
    }).then(() => ({
      exchangeName: exchangeName
    }))
  }

module.exports = publisherRoutePattern
