'use strict';

const assert = require('assert-plus');

class PublisherRoutePattern {
  constructor(options) {
    let exchangeType = 'topic';
    assert.optionalObject(options, 'options');

    if(options && options.exchangeType) {
      exchangeType = options.exchangeType;
    }
    this.exchangeType = exchangeType;
  }

  createTopology(topology, serviceDomainName, appName, routeName) {
    let exchangeName = serviceDomainName + '.' + appName + '.' + routeName;

    return topology.createExchange({
      name: exchangeName,
      type: this.exchangeType,
      durable: true
    }).then(() => {
      return {
        exchangeName: exchangeName
      };
    });
  }
}

module.exports = PublisherRoutePattern;
