'use strict';

var Publisher = require('./publisher');
var Consumer = require('./consumer');

/**
 * @module MagicBus
 */
module.exports = {
  /** {@link Broker} */
  Broker: require('./broker'),
  /** {@link Binder} */
  Binder: require('./binder'),

  /** {@link Publisher} */
  Publisher: Publisher,
  /** {@link Subscriber} */
  Subscriber: require('./subscriber-shim'),

  /** Synonym for {@link Publisher} */
  Sender: Publisher,
  /** Synonym for {@link Consumer} */
  Receiver: Consumer,
  /** {@link Consumer} */
  Consumer: Consumer,

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
