'use strict';

var Sender = require('./sender');
var Receiver = require('./receiver');

/**
 * @module MagicBus
 */
module.exports = {
  /** {@link Broker} */
  Broker: require('./broker'),

  /** Synonym for {@link Sender} */
  Publisher: Sender,
  /** {@link Subscriber} */
  Subscriber: require('./subscriber-shim'),

  /** {@link Sender} */
  Sender: Sender,
  /** {@link Receiver} */
  Receiver: Receiver,

  /** {@link AbstractEnvelope} */
  AbstractEnvelope: require('./abstract-envelope'),
  /** {@link BasicEnvelope} */
  BasicEnvelope: require('./basic-envelope'),

  /** {@link JsonSerializer} */
  JsonSerializer: require('./json-serializer'),

  /** {@link RoutePatterns} */
  RoutePatterns: {
    /** {@link RoutePatterns.Publisher} */
    Publisher: require('./route-patterns/publisher-route-pattern'),
    /** {@link RoutePatterns.Worker} */
    Worker: require('./route-patterns/worker-route-pattern'),
    /** {@link RoutePatterns.Listener} */
    Listener: require('./route-patterns/listener-route-pattern')
  }
};
