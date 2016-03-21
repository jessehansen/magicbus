'use strict';

var shortid = require('shortid');

module.exports = ListenerRoutePattern;

function ListenerRoutePattern() {

}

Object.defineProperties(ListenerRoutePattern.prototype, {
  createTopology: {
    value: function(topology, serviceDomainName, appName, routeName) {
      var baseName = serviceDomainName + '.' + appName + '.' + routeName;
      var randomListenerName = baseName + '.listener-' + shortid.generate();

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

    },
    enumerable: true
  }
});
