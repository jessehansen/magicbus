'use strict';

var Publisher = require('./lib/publisher.js');
var Consumer = require('./lib/consumer.js');

module.exports = {
  Broker: require('./lib/broker.js'),

  Publisher: Publisher,
  Subscriber: require('./lib/subscriber-shim.js'),

  Sender: Publisher, // Deprecated, Publisher and Sender are now synonyms
  Receiver: Consumer, // Deprecated, Consumer and Receiver are now synonyms
  Consumer: Consumer,

  AbstractEnvelope: require('./lib/abstract-envelope.js'),
  BasicEnvelope: require('./lib/basic-envelope.js'),

  JsonSerializer: require('./lib/json-serializer.js'),

  RoutePatterns: {
    Publisher: require('./lib/route-patterns/publisher-route-pattern.js'),
    Worker: require('./lib/route-patterns/worker-route-pattern.js'),
    Listener: require('./lib/route-patterns/listener-route-pattern.js')
  }
};
