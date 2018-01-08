const existingTopologyRoutePattern = ({ exchangeName, queueName } = {}) =>
  async (topology /*, serviceDomainName, appName, routeName */) => {
    if (exchangeName) {
      await topology.connectExchange(exchangeName)
    }
    if (queueName) {
      await topology.connectQueue(queueName)
    }
    return { exchangeName, queueName }
  }

module.exports = existingTopologyRoutePattern
