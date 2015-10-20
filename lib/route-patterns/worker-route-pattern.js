'use strict';

module.exports = WorkerRoutePattern;

function WorkerRoutePattern() {

}

Object.defineProperties(WorkerRoutePattern.prototype, {
  assertRoute: {
    value: function(serviceDomainName, appName, routeName, channel) {
      var baseName = serviceDomainName + '.' + appName + '.' + routeName;
      var failedName = baseName + '.failed';

      return channel.assertExchange(failedName, 'fanout', {durable: true})
        .then(function() {
          return channel.assertQueue(failedName);
        }).then(function() {
          return channel.bindQueue(failedName, failedName, '');
        }).then(function() {
          var workerQueueOptions = {
            deadLetterExchange: failedName
          };
          return channel.assertQueue(baseName, workerQueueOptions);
        }).then(function(){
          return {queueName: baseName};
        });
    },
    enumerable: true
  }
});