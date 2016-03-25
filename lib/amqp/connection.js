'use strict';
// initial version from https://github.com/LeanKit-Labs/wascally

var amqp = require('amqplib');
var _ = require('lodash');
var fs = require('fs');
var AmqpConnection = require('amqplib/lib/callback_model').CallbackModel;
var promiseFn = require('./machine-factory');
var Promise = require('bluebird');

function getArgs(fn) {
  var fnString = fn.toString();
  return _.map(/[(]([^)]*)[)]/.exec(fnString)[1].split(','), function(x) {
    return String.prototype.trim.bind(x)();
  });
}

function supportsDefaults(opts) {
  return opts.get && getArgs(opts.get).length > 1;
}

function trim(x) {
  return x.trim(' ');
}

function getOption(opts, key, alt) {
  if (opts.get && supportsDefaults(opts.get)) {
    return opts.get(key, alt);
  }
  return opts[key] || alt;
}

function getUri(protocol, user, pass, server, port, vhost, heartbeat) {
  return protocol + user + ':' + pass +
    '@' + server + ':' + port + '/' + vhost +
    '?heartbeat=' + heartbeat;
}

function split(x) {
  if (_.isNumber(x)) {
    return [x];
  }
  if (_.isArray(x)) {
    return x;
  }
  return x.split(',').map(trim);
}

/* eslint complexity: 1 */
function Adapter(parameters, log) {
  var timeout, certPath, keyPath, caPaths, passphrase, pfxPath, useSSL, list;
  var serverList = getOption(parameters, 'RABBIT_BROKER') || getOption(parameters, 'server', 'localhost');
  var portList = getOption(parameters, 'RABBIT_PORT') || getOption(parameters, 'port', 5672);

  this.name = parameters ? (parameters.name || 'default') : 'default';
  this.connectionIndex = 0;
  this.servers = split(serverList);
  this.ports = split(portList);
  this.heartbeat = getOption(parameters, 'RABBIT_HEARTBEAT') || getOption(parameters, 'heartbeat', 30);
  this.protocol = getOption(parameters, 'RABBIT_PROTOCOL') || getOption(parameters, 'protocol', 'amqp://');
  this.pass = getOption(parameters, 'RABBIT_PASSWORD') || getOption(parameters, 'pass', 'guest');
  this.user = getOption(parameters, 'RABBIT_USER') || getOption(parameters, 'user', 'guest');
  this.vhost = getOption(parameters, 'RABBIT_VHOST') || getOption(parameters, 'vhost', '%2f');
  timeout = getOption(parameters, 'RABBIT_TIMEOUT') || getOption(parameters, 'timeout');
  certPath = getOption(parameters, 'RABBIT_CERT') || getOption(parameters, 'certPath');
  keyPath = getOption(parameters, 'RABBIT_KEY') || getOption(parameters, 'keyPath');
  caPaths = getOption(parameters, 'RABBIT_CA') || getOption(parameters, 'caPath');
  passphrase = getOption(parameters, 'RABBIT_PASSPHRASE') || getOption(parameters, 'passphrase');
  pfxPath = getOption(parameters, 'RABBIT_PFX') || getOption(parameters, 'pfxPath');
  useSSL = certPath || keyPath || passphrase || caPaths || pfxPath;
  this.options = { noDelay: true };
  if (timeout) {
    this.options.timeout = timeout;
  }
  if (certPath) {
    this.options.cert = fs.readFileSync(certPath);
  }
  if (keyPath) {
    this.options.key = fs.readFileSync(keyPath);
  }
  if (passphrase) {
    this.options.passphrase = passphrase;
  }
  if (pfxPath) {
    this.options.pfx = fs.readFileSync(pfxPath);
  }
  if (caPaths) {
    list = caPaths.split(',');
    this.options.ca = _.map(list, function(caPath) {
      return fs.readFileSync(caPath);
    });
  }
  if (useSSL) {
    this.protocol = 'amqps://';
  }
  this.limit = _.max([this.servers.length, this.ports.length]);
  this.log = log.scoped('amqp-connection');
};

/* eslint no-invalid-this:1 */
Adapter.prototype.connect = function() {
  return new Promise(function(resolve, reject) {
    var attempted = [];
    var attempt;
    attempt = function() {
      var nextUri = this.getNextUri();
      this.log.info(`Attempting connection to ${this.name} (${nextUri})`);
      function onConnection(connection) {
        connection.uri = nextUri;
        this.log.info(`Connected to ${this.name} (${nextUri})`);
        resolve(connection);
      }
      function onConnectionError(err) {
        this.log.info(`Failed to connect to ${this.name} (${nextUri})`, err);
        attempted.push(nextUri);
        this.bumpIndex();
        attempt(err);
      }
      if (_.indexOf(attempted, nextUri) < 0) {
        amqp.connect(nextUri, this.options)
          .then(onConnection.bind(this), onConnectionError.bind(this));
      } else {
        this.log.info(`Cannot connect to ${this.name} - all endpoints failed`);
        reject(new Error('No endpoints could be reached'));
      }
    }.bind(this);
    attempt();
  }.bind(this));
};

Adapter.prototype.bumpIndex = function() {
  if (this.limit - 1 > this.connectionIndex) {
    this.connectionIndex++;
  } else {
    this.connectionIndex = 0;
  }
};

Adapter.prototype.getNextUri = function() {
  var server = this.getNext(this.servers);
  var port = this.getNext(this.ports);
  var uri = getUri(this.protocol, this.user, escape(this.pass), server, port, this.vhost, this.heartbeat);
  return uri;
};

Adapter.prototype.getNext = function(list) {
  if (this.connectionIndex >= list.length) {
    return list[0];
  }
  return list[this.connectionIndex];
};

module.exports = function(options, log) {
  var close = function(connection) {
    connection.close();
  };
  var adapter = new Adapter(options, log);
  return promiseFn(adapter.connect.bind(adapter), AmqpConnection, close, 'close', log);
};
