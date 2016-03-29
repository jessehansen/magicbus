'use strict';

const Promise = require('bluebird');
const _ = require('lodash');
const Monologue = require('monologue.js');

let ExchangeMachine;
let QueueMachine;

function getKeys(keys) {
  let actualKeys = [''];
  if (keys && keys.length > 0) {
    actualKeys = _.isArray(keys) ? keys : [keys];
  }
  return actualKeys;
}

function toArray(x, list) {
  if (_.isArray(x)) {
    return x;
  }
  if (_.isObject(x) && list) {
    return _.map(x, (item) => {
      return item;
    });
  }
  if (_.isUndefined(x) || _.isEmpty(x)) {
    return [];
  }
  return [x];
}

/**
 * Represents a set of related queues, exchanges, bindings, etc. Supports
 * rebuilding topology upon (re)connection to rabbitmq
 */
class Topology {
  /**
   * Creates a topology instance
   * @param {Connection} connection - the connection state machine
   * @param {Object} logger - the logger
   */
  constructor(connection, logger) {
    this.connection = connection;
    this.channels = {};
    this.promises = {};
    this.definitions = {
      bindings: {},
      exchanges: {},
      queues: {}
    };
    this.logger = logger;

    connection.on('reconnected', () => {
      this.onReconnect();
    });
  }

  /**
   * Configures multiple bindings
   *
   * @public
   * @param {Object|Array} bindings - bindings to create.
   * @param {bool} list - true if bindings is an object with each value representing a binding
   * @returns {Promise} a promise that is fulfilled when all of the bindings have been created
   */
  configureBindings(bindings, list) {
    if (_.isUndefined(bindings)) {
      return Promise.resolve(true);
    }
    let actualDefinitions = toArray(bindings, list);
    let promises = _.map(actualDefinitions, (def) => {
      let q = this.definitions.queues[def.target];
      return this.createBinding(
        {
          source: def.exchange || def.source,
          target: def.target,
          keys: def.keys,
          queue: q !== undefined
        });
    });
    if (promises.length === 0) {
      return Promise.resolve(true);
    }
    return Promise.all(promises);
  }

  /**
   * Configures multiple queues
   *
   * @public
   * @param {Object|Array} queues - queues to create.
   * @param {bool} list - true if queues is an object with each value representing a queue
   * @returns {Promise} a promise that is fulfilled when all of the queues have been created
   */
  configureQueues(queues, list) {
    if (_.isUndefined(queues)) {
      return Promise.resolve(true);
    }
    let actualDefinitions = toArray(queues, list);
    let promises = _.map(actualDefinitions, (def) => {
      return this.createQueue(def);
    });
    return Promise.all(promises);
  }

  /**
   * Configures multiple exchanges
   *
   * @public
   * @param {Object|Array} exchanges - exchanges to create.
   * @param {bool} list - true if exchanges is an object with each value representing an exchange
   * @returns {Promise} a promise that is fulfilled when all of the exchanges have been created
   */
  configureExchanges(exchanges, list) {
    if (_.isUndefined(exchanges)) {
      return Promise.resolve(true);
    }
    let actualDefinitions = toArray(exchanges, list);
    let promises = _.map(actualDefinitions, (def) => {
      return this.createExchange(def);
    });
    return Promise.all(promises);
  }

  /**
   * Create a binding from an exchange to an exchange or a queue
   *
   * @public
   * @param {Object} options - details of the binding
   * @param {String} options.source - name of the source exchange
   * @param {String} options.target - name of the target exchange or queue
   * @param {bool} options.queue - true if options.target is a queue
   * @param {Array|string} options.keys - routing key pattern(s) that should be bound
   * @returns {Promise} a promise that is fulfilled when the binding has been created
   */
  createBinding(options) {
    let id = [options.source, options.target].join('->');
    let promise = this.promises[id];
    if(!promise) {
      this.definitions.bindings[id] = options;
      let call = options.queue ? 'bindQueue' : 'bindExchange';
      let source = options.source;
      let target = options.target;
      let keys = getKeys(options.keys);
      let channel = this.getChannel('control');
      this.logger.info(`Binding \'${target}\' to \'${source}\' on \'${this.connection.name}\' with keys: ${JSON.stringify(keys)}`);
      this.promises[id] = promise = Promise.map(keys, (key) => {
        return channel[call](target, source, key);
      });
    }
    return promise;
  }

  /**
   * Create a queue or exchange
   *
   * @private
   * @param {Function} Primitive - Queue or Exchange state machine factory function
   * @param {String} primitiveType - exchange or queue
   * @param {Object} options - details for the object, passed along to Primitive constructor, which may take additional options.
   * @param {String} options.name - name of the exchange or queue
   * @returns {Promise} a promise that is fulfilled when the primitive has been created
   */
  createPrimitive(Primitive, primitiveType, options) {
    let errorFn = (err) => {
      return new Error(`Failed to create ${primitiveType} \'${options.name}\' on connection \'${this.connection.name}\' with \'${err ? (err.message || err) : 'N/A'}\'`);
    };
    let definitions = primitiveType === 'exchange' ? this.definitions.exchanges : this.definitions.queues;
    let channelName = [primitiveType, options.name].join(':');
    let promise = this.promises[channelName];
    if(!promise) {
      this.promises[channelName] = promise = new Promise((resolve, reject) => {
        definitions[options.name] = options;
        let primitive = this.channels[channelName] = Primitive(options, this.connection, this, this.logger);
        let onConnectionFailed = (connectionError) => {
          reject(errorFn(connectionError));
        };
        if (this.connection.state === 'failed') {
          onConnectionFailed(this.connection.lastError());
        } else {
          let onFailed = this.connection.on('failed', (err) => {
            onConnectionFailed(err);
          });
          primitive.once('defined', () => {
            onFailed.unsubscribe();
            resolve(primitive);
          });
        }
        primitive.once('failed', (err) => {
          delete definitions[options.name];
          delete this.channels[channelName];
          reject(errorFn(err));
        });
      });
    }
    return promise;
  }

  /**
   * Create an exchange. Adds a channel exchange:[name]
   *
   * @public
   * @param {Object} options - details for the exchange, passed along to ExchangeMachine constructor, which may take additional options.
   * @param {String} options.name - exchange name
   * @param {String} options.type - exchange type (fanout, headers, topic, direct)
   * @param {bool} options.durable - if true, the exchange will survive broker restarts. Defaults to true.
   * @param {bool} options.internal - if true, messages cannot be published directly to the exchange (i.e., it can only be the target of bindings, or possibly create messages ex-nihilo). Defaults to false.
   * @param {bool} options.autoDelete - if true, the exchange will be destroyed once the number of bindings for which it is the source drop to zero. Defaults to false.
   * @param {String} options.alternateExchange - an exchange to send messages to if this exchange can't route them to any queues. Alias: options.alternate
   * @param {Object} options.arguments - any additional arguments that may be needed by an exchange type.
   * @param {String} options.publishTimeout - how long to wait before timing out a publish (defaults to 0, or indefinite)
   * @returns {Promise} a promise that is fulfilled when the exchange has been created
   */
  createExchange(options) {
    return this.createPrimitive(ExchangeMachine, 'exchange', options);
  }

  /**
   * Create a queue. Adds a channel queue:[name]
   *
   * @public
   * @param {Object} options - details in creating the queue - passed to amqplib's assertExchange function
   * @param {String} options.name - queue name
   * @param {Number} options.limit - the channel prefetch limit
   * @param {bool} options.noBatch - if true, ack/nack/reject operations will execure immediately and not be batched
   * @param {bool} options.noAck - if true, do not ack messages on the queue, only nack or reject. Passed to channel.consume
   * @param {bool} options.exclusive - if true, scopes the queue to the connection (defaults to false)
   * @param {bool} options.durable - if true, the queue will survive broker restarts, modulo the effects of exclusive and autoDelete; this defaults to true if not supplied, unlike the others
   * @param {bool} options.autoDelete - if true, the queue will be deleted when the number of consumers drops to zero (defaults to false)
   * @param {Number} options.messageTtl (0 <= n < 2^32): expires messages arriving in the queue after n milliseconds
   * @param {Number} options.expires (0 < n < 2^32): the queue will be destroyed after n milliseconds of disuse, where use means having consumers, being declared (asserted or checked, in this API), or being polled with a #get.
   * @param {String} options.deadLetterExchange - an exchange to which messages discarded from the queue will be resent. Use deadLetterRoutingKey to set a routing key for discarded messages; otherwise, the message's routing key (and CC and BCC, if present) will be preserved. A message is discarded when it expires or is rejected or nacked, or the queue limit is reached. Aliased as options.deadLetter
   * @param {String} options.deadLetterRoutingKey - routing key to set on discarded messages. Ignored if deadLetterExchange is not also set
   * @param {Number} options.maxLength - sets a maximum number of messages the queue will hold. Old messages will be discarded (dead-lettered if that's set) to make way for new messages. Aliased as options.queueLimit
   * @param {Number} options.maxPriority -  makes the queue a priority queue.
   * @param {Object} options.arguments - additional arguments, usually parameters for some kind of broker-specific extension e.g., high availability, TTL.
   * @returns {Promise} a promise that is fulfilled when the queue has been created
   */
  createQueue(options) {
    return this.createPrimitive(QueueMachine, 'queue', options);
  }

  /**

   * Delete an exchange
   *
   * @public
   * @param {String} name - exchange name
   * @returns {Promise} a promise that is fulfilled when the exchange has been deleted
   */
  deleteExchange(name) {
    let key = 'exchange:' + name;
    let channel = this.channels[key];
    if (channel) {
      channel.destroy();
      delete this.channels[key];
      this.logger.info(`Deleting ${channel.type} exchange \'${name}\' on connection \'${this.connection.name}\'`);
    }
    let control = this.getChannel('control');
    return control.deleteExchange(name);
  }

  /**
   * Delete a queue
   *
   * @public
   * @param {String} name - queue name
   * @returns {Promise} a promise that is fulfilled when the queue has been deleted
   */
  deleteQueue(name) {
    let key = 'queue:' + name;
    let channel = this.channels[key];
    if (channel) {
      channel.destroy();
      delete this.channels[key];
      this.logger.info(`Deleting queue \'${name}\' on connection \'${this.connection.name}\'`);
    }
    let control = this.getChannel('control');
    return control.deleteQueue(name);
  }

  /**
   * Get a channel by its name. Creates a channel if one does not exist.
   *
   * @public
   * @param {String} name - channel name
   * @returns {Channel} a channel
   */
  getChannel(name) {
    let channel = this.channels[name];
    if (!channel) {
      channel = this.connection.createChannel(false);
      this.channels[name] = channel;
    }
    return channel;
  }

  /**
   * Connection reconnected event handler. Reopens channels and recreates bindings
   *
   * @private
   */
  onReconnect() {
    this.logger.info(`Reconnection to \'${this.connection.name}\' established - rebuilding topology`);
    this.promises = {};
    let prerequisites = _.map(this.channels, (channel) => {
      return channel.check ? channel.check() : Promise.resolve(true);
    });
    Promise.all(prerequisites)
      .then(() => {
        this.configureBindings(this.definitions.bindings, true)
          .then(() => {
            this.logger.info(`Topology rebuilt for connection \'${this.connection.name}\'`);
            this.emit('bindings-completed');
          });
      });
  }

  /**
   * Resets topology, removing all channels, definitions, and bindings. Also resets connection
   *
   * @public
   */
  reset() {
    _.each(this.channels, (channel) => {
      if (channel.destroy) {
        channel.destroy();
      }
    });
    this.channels = {};
    this.connection.reset();
    this.definitions = {
      bindings: {},
      exchanges: {},
      queues: {},
      subscriptions: {}
    };
  }
}

Monologue.mixInto(Topology);

/**
 * Topology factory function
 *
 * @public
 * @param {Connection} connection - the connection state machine
 * @param {Object} logger - the logger
 * @param {Object} exchangeMachine - the ExchangeMachine class, allows overriding the default implementation
 * @param {Object} queueMachine - the QueueMachine class, allows overriding the default implementation
 */
module.exports = function CreateTopology(connection, log, exchangeMachine, queueMachine) {
  ExchangeMachine = exchangeMachine || require('./exchange-machine');
  QueueMachine = queueMachine || require('./queue-machine');

  return new Topology(connection, log);
};
