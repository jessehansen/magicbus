'use strict';

class WorkerRoutePattern{
  constructor(options){
    this.options = options || {};
  }

  createTopology(topology, serviceDomainName, appName, routeName) {
    let baseName = serviceDomainName + '.' + appName + '.' + routeName;
    let failedName = baseName + '.failed';

    return topology.createExchange({
      name: failedName,
      type: 'fanout',
      durable: true
    }).then(() => {
      return topology.createQueue({ name: failedName });
    }).then(() => {
      return topology.createBinding(
        {
          source: failedName,
          target: failedName
        });
    }).then(() => {
      return topology.createQueue({
        name: baseName,
        deadLetter: failedName,
        noAck: this.options.noAck
      });
    }).then(() => {
      return { queueName: baseName };
    });

  }
}

module.exports = WorkerRoutePattern;
