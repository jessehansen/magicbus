'use strict';

var assert = require('assert-plus');
var Promise = require('bluebird');

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
      
      return new Promise(function(resolve, reject) {
        var exchangeName = serviceDomainName + '.' + appName + '.' + routeName;

        channel.assertExchange(exchangeName, self.exchangeType, {
          durable: true
        });

        resolve({
          exchangeName: exchangeName
        });
      });
    },
    enumerable: true
  }
});