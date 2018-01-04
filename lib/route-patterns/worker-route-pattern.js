
const assert = require('assert-plus')

class WorkerRoutePattern {
  constructor (options) {
    assert.optionalObject(options, 'options')
    this.options = options || {}
  }

  createTopology (topology, serviceDomainName, appName, routeName) {
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
      noAck: this.options.noAck
    })).then(() => ({ queueName: baseName }))
  }
}

module.exports = WorkerRoutePattern
