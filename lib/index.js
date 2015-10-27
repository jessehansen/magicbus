'use strict';

var Sender = require('./sender');
var Receiver = require('./receiver');

/**
 * @module MagicBus
 */
module.exports = {
  /** {@link Broker} */
  Broker: require('./lib/broker'),

  /** Synonym for {@link Sender} */
  Publisher: Sender,
  /** {@link Subscriber} */
  Subscriber: require('./lib/subscriber-shim'),

  /** {@link Sender} */
  Sender: Sender,
  /** {@link Receiver} */
  Receiver: Receiver,

  /** {@link AbstractEnvelope} */
  AbstractEnvelope: require('./lib/abstract-envelope'),
  /** {@link BasicEnvelope} */
  BasicEnvelope: require('./lib/basic-envelope'),

  /** {@link JsonSerializer} */
  JsonSerializer: require('./lib/json-serializer'),

  /** {@link RoutePatterns} */
  RoutePatterns: {
    /** {@link RoutePatterns.Publisher} */
    Publisher: require('./lib/route-patterns/publisher-route-pattern'),
    /** {@link RoutePatterns.Worker} */
    Worker: require('./lib/route-patterns/worker-route-pattern'),
    /** {@link RoutePatterns.Listener} */
    Listener: require('./lib/route-patterns/listener-route-pattern')
  }
};
