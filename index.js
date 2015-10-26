'use strict';

var Sender = require('./lib/sender.js');

module.exports = {
  Broker: require('./lib/broker.js'),

  Publisher: Sender, // Deprecated, Publisher and Sender are now synonyms
  Subscriber: require('./lib/subscriber.js'),

  Sender: Sender,
  Receiver: require('./lib/consumer.js'),

  AbstractEnvelope: require('./lib/abstract-envelope.js'),
  BasicEnvelope: require('./lib/basic-envelope.js'),

  JsonSerializer: require('./lib/json-serializer.js'),

  RoutePatterns: {
    Publisher: require('./lib/route-patterns/publisher-route-pattern.js'),
    Worker: require('./lib/route-patterns/worker-route-pattern.js'),
    Listener: require('./lib/route-patterns/listener-route-pattern.js')
  }
};
