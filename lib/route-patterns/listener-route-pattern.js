'use strict';

var shortid = require('shortid');

module.exports = WorkerRoutePattern;

function WorkerRoutePattern() {

}

Object.defineProperties(WorkerRoutePattern.prototype, {
  assertRoute: {
    value: function(serviceDomainName, appName, routeName, channel) {
      var baseName = serviceDomainName + '.' + appName + '.' + routeName;
      var randomListenerName = baseName + '.listener-' + shortid.generate();

      return channel.assertExchange(baseName, 'fanout', {durable: true})
      .then(function() {
        var listenerQueueOptions = {
          exclusive: true,
          durable: false
        };

        return channel.assertQueue(randomListenerName, listenerQueueOptions);
      }).then(function() {
        return channel.bindQueue(randomListenerName, baseName, '');
      }).then(function() {
        return {
          queueName: randomListenerName
        };
      });

    },
    enumerable: true
  }
});