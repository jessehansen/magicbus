'use strict';

var Promise = require('bluebird');
var _ = require('lodash');
var Monologue = require('monologue.js');
var Exchange, Queue;

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

function Topology(connection, options, unhandledStrategies, log) {
  this.connection = connection;
  this.channels = {};
  this.promises = {};
  this.definitions = {
    bindings: {},
    exchanges: {},
    queues: {}
  };
  this.options = options;
  this.onUnhandled = function(message) {
    return unhandledStrategies.onUnhandled(message);
  };
  this.log = log;

  connection.on('reconnected', function() {
    this.onReconnect();
  }.bind(this));
};

Topology.prototype.configureBindings = function(bindingDef, list) {
  var actualDefinitions, bindings;
  if (_.isUndefined(bindingDef)) {
    return Promise.resolve(true);
  }
  actualDefinitions = toArray(bindingDef, list);
  bindings = _.map(actualDefinitions, function(def) {
    var q = this.definitions.queues[def.target];
    return this.createBinding(
      {
        source: def.exchange || def.source,
        target: def.target,
        keys: def.keys,
        queue: q !== undefined
      });
  }.bind(this));
  if (bindings.length === 0) {
    return Promise.resolve(true);
  }
  return Promise.all(bindings);
};

Topology.prototype.configureQueues = function(queueDef, list) {
  var actualDefinitions, queues;
  if (_.isUndefined(queueDef)) {
    return Promise.resolve(true);
  }
  actualDefinitions = toArray(queueDef, list);
  queues = _.map(actualDefinitions, function(def) {
    return this.createQueue(def);
  }.bind(this));
  return Promise.all(queues);
};

Topology.prototype.configureExchanges = function(exchangeDef, list) {
  var actualDefinitions, exchanges;
  if (_.isUndefined(exchangeDef)) {
    return Promise.resolve(true);
  }
  actualDefinitions = toArray(exchangeDef, list);
  exchanges = _.map(actualDefinitions, function(def) {
    return this.createExchange(def);
  }.bind(this));
  return Promise.all(exchanges);
};

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
    this.log.info(`Binding \'${target}\' to \'${source}\' on \'${this.connection.name}\' with keys: ${JSON.stringify(keys)}`);
    this.promises[id] = promise = Promise.map(keys, function(key) {
      return channel[call](target, source, key);
    });
  }
  return promise;
};

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
      primitive = this.channels[channelName] = new Primitive(options, this.connection, this, this.log);
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

Topology.prototype.createExchange = function(options) {
  return this.createPrimitive(Exchange, 'exchange', options);

};

Topology.prototype.createQueue = function(options) {
  return this.createPrimitive(Queue, 'queue', options);
};

Topology.prototype.deleteExchange = function(name) {
  var control;
  var key = 'exchange:' + name;
  var channel = this.channels[key];
  if (channel) {
    channel.destroy();
    delete this.channels[key];
    this.log.info(`Deleting ${channel.type} exchange \'${name}\' on connection \'${this.connection.name}\'`);
  }
  control = this.getChannel('control');
  return control.deleteExchange(name);
};

Topology.prototype.deleteQueue = function(name) {
  var control;
  var key = 'queue:' + name;
  var channel = this.channels[key];
  if (channel) {
    channel.destroy();
    delete this.channels[key];
    this.log.info(`Deleting queue \'${name}\' on connection \'${this.connection.name}\'`);
  }
  control = this.getChannel('control');
  return control.deleteQueue(name);
};

Topology.prototype.getChannel = function(name) {
  var channel = this.channels[name];
  if (!channel) {
    channel = this.connection.createChannel(false);
    this.channels[name] = channel;
  }
  return channel;
};

Topology.prototype.onReconnect = function() {
  var prerequisites;
  this.log.info(`Reconnection to \'${this.connection.name}\' established - rebuilding topology`);
  this.promises = {};
  prerequisites = _.map(this.channels, function(channel) {
    return channel.check ? channel.check() : Promise.resolve(true);
  });
  Promise.all(prerequisites)
    .then(function() {
      this.configureBindings(this.definitions.bindings, true)
        .then(function() {
          this.log.info(`Topology rebuilt for connection \'${this.connection.name}\'`);
          this.emit('bindings-completed');
        }.bind(this));
    }.bind(this));
};

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

module.exports = function(connection, options, unhandledStrategies, log, exchangeFsm, queueFsm) {
  // allows us to optionally provide mocks and control the default queue name
  Exchange = exchangeFsm || require('./exchange-machine');
  Queue = queueFsm || require('./queue-machine');

  return new Topology(connection, options, unhandledStrategies, log);
};
