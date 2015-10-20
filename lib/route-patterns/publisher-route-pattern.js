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
    value: function(serviceDomainName, appName, routeName, channel) {
      var self = this;

      var exchangeName = serviceDomainName + '.' + appName + '.' + routeName;

      return channel.assertExchange(exchangeName, self.exchangeType, {
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