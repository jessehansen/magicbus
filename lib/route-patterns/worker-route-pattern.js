'use strict';

module.exports = WorkerRoutePattern;

function WorkerRoutePattern() {

}

Object.defineProperties(WorkerRoutePattern.prototype, {
  assertTopology: {
    value: function(topology, serviceDomainName, appName, routeName) {
      var baseName = serviceDomainName + '.' + appName + '.' + routeName;
      var failedName = baseName + '.failed';

      return topology.createExchange({
        name: failedName,
        type: 'fanout',
        durable: true
      }).then(function(){
        return topology.createQueue({ name: failedName });
      }).then(function(){
        return topology.createBinding(
          {
            source: failedName,
            target: failedName
          });
      }).then(function(){
        return topology.createQueue({
          name: baseName,
          deadLetter: failedName
        });
      }).then(function(){
        return { queueName: baseName };
      });
    },
    enumerable: true
  }
});
