'use strict';

var assert = require('assert-plus');

module.exports = PublisherRoutePattern;

function PublisherRoutePattern(options) {
  assert.optionalObject(options, 'options');

  var exchangeType = 'topic';
  if(options && options.exchangeType) {
    exchangeType = options.exchangeType;
  }

  Object.defineProperties(this, {
    exchangeType: {
      value: exchangeType,
      enumerable: true
    }
  });
}

Object.defineProperties(PublisherRoutePattern.prototype, {
  assertRoute: {
    value: function(topology, serviceDomainName, appName, routeName) {
      var self = this;

      var exchangeName = serviceDomainName + '.' + appName + '.' + routeName;

      return topology.createExchange({
        name: exchangeName,
        type: self.exchangeType,
        durable: true
      }).then(function() {
        return {
          exchangeName: exchangeName
        };
      });
    },
    enumerable: true
  }
});
