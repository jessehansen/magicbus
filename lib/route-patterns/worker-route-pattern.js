const assert = require('assert-plus')

const workerRoutePatternFactory = (options = {}) => {
  assert.optionalObject(options, 'options')

  return (topology, serviceDomainName, appName, routeName) => {
    let baseName = serviceDomainName + '.' + appName + '.' + routeName
    let failedName = baseName + '.failed'

    return topology.createExchange({
      name: failedName,
      type: 'fanout',
      durable: true
    }).then(() => topology.createQueue({ name: failedName })).then(() => topology.createBinding(
      {
        source: failedName,
        target: failedName
      })).then(() => topology.createQueue({
      name: baseName,
      deadLetter: failedName,
      noAck: options.noAck
    })).then(() => ({ queueName: baseName }))
  }
}

module.exports = workerRoutePatternFactory
