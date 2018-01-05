const shortid = require('shortid')

const listenerRoutePattern = () => (topology, serviceDomainName, appName, routeName) => {
  let baseName = serviceDomainName + '.' + appName + '.' + routeName
  let randomListenerName = baseName + '.listener-' + shortid.generate()

  return topology.createExchange({
    name: baseName,
    type: 'fanout',
    durable: true
  }).then(() => topology.createQueue({
    name: randomListenerName,
    exclusive: true,
    durable: false
  })).then(() => topology.createBinding({
    source: baseName,
    target: randomListenerName
  })).then(() => ({
    queueName: randomListenerName
  }))
}

module.exports = listenerRoutePattern
