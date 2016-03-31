'use strict';

const shortid = require('shortid');

class ListenerRoutePattern {
  createTopology(topology, serviceDomainName, appName, routeName) {
    let baseName = serviceDomainName + '.' + appName + '.' + routeName;
    let randomListenerName = baseName + '.listener-' + shortid.generate();

    return topology.createExchange({
      name: baseName,
      type: 'fanout',
      durable: true
    }).then(function() {
      return topology.createQueue({
        name: randomListenerName,
        exclusive: true,
        durable: false
      });
    }).then(function() {
      return topology.createBinding(
        {
          source: baseName,
          target: randomListenerName
        });
    }).then(function() {
      return {
        queueName: randomListenerName
      };
    });
  }
}

module.exports = ListenerRoutePattern;
