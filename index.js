'use strict';

var Sender = require('./lib/sender.js');
var Receiver = require('./lib/receiver.js');

module.exports = {
  Broker: require('./lib/broker.js'),

  Publisher: Sender, // Deprecated, Publisher and Sender are now synonyms
  Subscriber: require('./lib/subscriber-shim.js'),

  Sender: Sender,
  Receiver: Receiver,

  AbstractEnvelope: require('./lib/abstract-envelope.js'),
  BasicEnvelope: require('./lib/basic-envelope.js'),

  JsonSerializer: require('./lib/json-serializer.js'),

  RoutePatterns: {
    Publisher: require('./lib/route-patterns/publisher-route-pattern.js'),
    Worker: require('./lib/route-patterns/worker-route-pattern.js'),
    Listener: require('./lib/route-patterns/listener-route-pattern.js')
  }
};
