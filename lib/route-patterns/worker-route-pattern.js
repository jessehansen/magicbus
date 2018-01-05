const workerRoutePattern = ({ noAck = false } = {}) => (topology, serviceDomainName, appName, routeName) => {
  let baseName = serviceDomainName + '.' + appName + '.' + routeName
  let failedName = baseName + '.failed'

  return topology.createExchange({
    name: failedName,
    type: 'fanout',
    durable: true
  })
    .then(() => topology.createQueue({ name: failedName }))
    .then(() => topology.createBinding({
      source: failedName,
      target: failedName
    })).then(() => topology.createQueue({
      name: baseName,
      deadLetter: failedName,
      noAck: noAck
    })).then(() => ({ queueName: baseName }))
}

module.exports = workerRoutePattern
