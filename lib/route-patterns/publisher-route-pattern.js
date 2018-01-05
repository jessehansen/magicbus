const assert = require('assert-plus')

const publisherRoutePattern = (options = {}) => {
  let exchangeType = 'topic'
  assert.optionalObject(options, 'options')

  if (options && options.exchangeType) {
    exchangeType = options.exchangeType
  }
  return (topology, serviceDomainName, appName, routeName) => {
    let exchangeName = serviceDomainName + '.' + appName + '.' + routeName

    return topology.createExchange({
      name: exchangeName,
      type: exchangeType,
      durable: true
    }).then(() => ({
      exchangeName: exchangeName
    }))
  }
}

module.exports = publisherRoutePattern
