'use strict';

var Promise = require('bluebird');
var _ = require('lodash');
var Monologue = require('monologue.js');
var ExchangeMachine, QueueMachine;

function getKeys(keys) {
  var actualKeys = [''];
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
    return _.map(x, function(item) {
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
 *
 * @public
 * @constructor
 * @param {Connection} connection - the connection state machine
 * @param {Object} logger - the logger
 */
function Topology(connection, logger) {
  this.connection = connection;
  this.channels = {};
  this.promises = {};
  this.definitions = {
    bindings: {},
    exchanges: {},
    queues: {}
  };
  this.logger = logger;

  connection.on('reconnected', function() {
    this.onReconnect();
  }.bind(this));
};

/**
 * Configures multiple bindings
 *
 * @public
 * @param {Object|Array} bindings - bindings to create.
 * @param {bool} list - true if bindings is an object with each value representing a binding
 * @returns {Promise} a promise that is fulfilled when all of the bindings have been created
 */
Topology.prototype.configureBindings = function(_bindings, list) {
  var actualDefinitions, promises;
  if (_.isUndefined(_bindings)) {
    return Promise.resolve(true);
  }
  actualDefinitions = toArray(_bindings, list);
  promises = _.map(actualDefinitions, function(def) {
    var q = this.definitions.queues[def.target];
    return this.createBinding(
      {
        source: def.exchange || def.source,
        target: def.target,
        keys: def.keys,
        queue: q !== undefined
      });
  }.bind(this));
  if (promises.length === 0) {
    return Promise.resolve(true);
  }
  return Promise.all(promises);
};

/**
 * Configures multiple queues
 *
 * @public
 * @param {Object|Array} queues - queues to create.
 * @param {bool} list - true if queues is an object with each value representing a queue
 * @returns {Promise} a promise that is fulfilled when all of the queues have been created
 */
Topology.prototype.configureQueues = function(queues, list) {
  var actualDefinitions, promises;
  if (_.isUndefined(queues)) {
    return Promise.resolve(true);
  }
  actualDefinitions = toArray(queues, list);
  promises = _.map(actualDefinitions, function(def) {
    return this.createQueue(def);
  }.bind(this));
  return Promise.all(promises);
};

/**
 * Configures multiple exchanges
 *
 * @public
 * @param {Object|Array} exchanges - exchanges to create.
 * @param {bool} list - true if exchanges is an object with each value representing an exchange
 * @returns {Promise} a promise that is fulfilled when all of the exchanges have been created
 */
Topology.prototype.configureExchanges = function(exchanges, list) {
  var actualDefinitions, promises;
  if (_.isUndefined(exchanges)) {
    return Promise.resolve(true);
  }
  actualDefinitions = toArray(exchanges, list);
  promises = _.map(actualDefinitions, function(def) {
    return this.createExchange(def);
  }.bind(this));
  return Promise.all(promises);
};

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
Topology.prototype.createBinding = function(options) {
  var call, source, target, keys, channel;
  var id = [options.source, options.target].join('->');
  var promise = this.promises[id];
  if(!promise) {
    this.definitions.bindings[id] = options;
    call = options.queue ? 'bindQueue' : 'bindExchange';
    source = options.source;
    target = options.target;
    keys = getKeys(options.keys);
    channel = this.getChannel('control');
    this.logger.info(`Binding \'${target}\' to \'${source}\' on \'${this.connection.name}\' with keys: ${JSON.stringify(keys)}`);
    this.promises[id] = promise = Promise.map(keys, function(key) {
      return channel[call](target, source, key);
    });
  }
  return promise;
};

/**
 * Create a queue or exchange
 *
 * @private
 * @param {Function} Primitive - Queue or Exchange state machine
 * @param {String} primitiveType - exchange or queue
 * @param {Object} options - details for the object, passed along to Primitive constructor, which may take additional options.
 * @param {String} options.name - name of the exchange or queue
 * @returns {Promise} a promise that is fulfilled when the primitive has been created
 */
Topology.prototype.createPrimitive = function(Primitive, primitiveType, options) {
  var primitive, onConnectionFailed, onFailed;
  var errorFn = function(err) {
    return new Error(`Failed to create ${primitiveType} \'${options.name}\' on connection \'${this.connection.name}\' with \'${err ? (err.message || err) : 'N/A'}\'`);
  }.bind(this);
  var definitions = primitiveType === 'exchange' ? this.definitions.exchanges : this.definitions.queues;
  var channelName = [primitiveType, options.name].join(':');
  var promise = this.promises[channelName];
  if(!promise) {
    this.promises[channelName] = promise = new Promise(function(resolve, reject) {
      definitions[options.name] = options;
      primitive = this.channels[channelName] = new Primitive(options, this.connection, this, this.logger);
      onConnectionFailed = function(connectionError) {
        reject(errorFn(connectionError));
      };
      if (this.connection.state === 'failed') {
        onConnectionFailed(this.connection.lastError());
      } else {
        onFailed = this.connection.on('failed', function(err) {
          onConnectionFailed(err);
        });
        primitive.once('defined', function() {
          onFailed.unsubscribe();
          resolve(primitive);
        });
      }
      primitive.once('failed', function(err) {
        delete definitions[options.name];
        delete this.channels[channelName];
        reject(errorFn(err));
      }.bind(this));
    }.bind(this));
  }
  return promise;
};

/**
 * Create an exchange. Adds a channel exchange:[name]
 *
 * @public
 * @param {Object} options - details for the exchange, passed along to ExchangeMachine constructor, which may take additional options.
 * @param {String} options.name - exchange name
 * @returns {Promise} a promise that is fulfilled when the exchange has been created
 */
Topology.prototype.createExchange = function(options) {
  return this.createPrimitive(ExchangeMachine, 'exchange', options);
};

/**
 * Create a queue. Adds a channel queue:[name]
 *
 * @public
 * @param {Object} options - details for the queue, passed along to QueueMachine constructor, which may take additional options.
 * @param {String} options.name - queue name
 * @returns {Promise} a promise that is fulfilled when the queue has been created
 */
Topology.prototype.createQueue = function(options) {
  return this.createPrimitive(QueueMachine, 'queue', options);
};

/**

 * Delete an exchange
 *
 * @public
 * @param {String} name - exchange name
 * @returns {Promise} a promise that is fulfilled when the exchange has been deleted
 */
Topology.prototype.deleteExchange = function(name) {
  var control;
  var key = 'exchange:' + name;
  var channel = this.channels[key];
  if (channel) {
    channel.destroy();
    delete this.channels[key];
    this.logger.info(`Deleting ${channel.type} exchange \'${name}\' on connection \'${this.connection.name}\'`);
  }
  control = this.getChannel('control');
  return control.deleteExchange(name);
};

/**
 * Delete a queue
 *
 * @public
 * @param {String} name - queue name
 * @returns {Promise} a promise that is fulfilled when the queue has been deleted
 */
Topology.prototype.deleteQueue = function(name) {
  var control;
  var key = 'queue:' + name;
  var channel = this.channels[key];
  if (channel) {
    channel.destroy();
    delete this.channels[key];
    this.logger.info(`Deleting queue \'${name}\' on connection \'${this.connection.name}\'`);
  }
  control = this.getChannel('control');
  return control.deleteQueue(name);
};

/**
 * Get a channel by its name. Creates a channel if one does not exist.
 *
 * @public
 * @param {String} name - channel name
 * @returns {Channel} a channel
 */
Topology.prototype.getChannel = function(name) {
  var channel = this.channels[name];
  if (!channel) {
    channel = this.connection.createChannel(false);
    this.channels[name] = channel;
  }
  return channel;
};

/**
 * Connection reconnected event handler. Reopens channels and recreates bindings
 *
 * @private
 */
Topology.prototype.onReconnect = function() {
  var prerequisites;
  this.logger.info(`Reconnection to \'${this.connection.name}\' established - rebuilding topology`);
  this.promises = {};
  prerequisites = _.map(this.channels, function(channel) {
    return channel.check ? channel.check() : Promise.resolve(true);
  });
  Promise.all(prerequisites)
    .then(function() {
      this.configureBindings(this.definitions.bindings, true)
        .then(function() {
          this.logger.info(`Topology rebuilt for connection \'${this.connection.name}\'`);
          this.emit('bindings-completed');
        }.bind(this));
    }.bind(this));
};

/**
 * Resets topology, removing all channels, definitions, and bindings. Also resets connection
 *
 * @public
 */
Topology.prototype.reset = function() {
  _.each(this.channels, function(channel) {
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
};

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
