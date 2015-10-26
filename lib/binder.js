'use strict';

var assert = require('assert-plus');
var Promise = require('bluebird');
var amqpUri = require('amqp-uri');

module.exports = Binder;

function Binder(connectionInfo) {
  assert.object(connectionInfo, 'connectionInfo');
  this._connectionInfo = connectionInfo;

  //Hold a reference on the instance so it can be replaced by a mock in tests
  this._amqp = require('amqplib');
}

function _assertRoute(route, channel) {
  console.log(route);
  return route.pattern.assertRoute(route.serviceDomainName, route.appName, route.name, channel);
}

Binder.prototype._createConnection = function Binder$_createConnection() {
  var self = this;
  console.log('connecting');

  if (self._connection) {
    return Promise.resolve(self._connection);
  } else {
    var connectionString = amqpUri(self._connectionInfo);
    return self._amqp.connect(connectionString).then(function(conn) {
      self._connection = conn;
      return conn;
    });
  }
};

Binder.prototype.bind = function Binder$bind(exchangeRoute, queueRoute, connection) {
  var channel, exchangeName, queueName;
  console.log('bind');

  return this._createConnection().then(function(conn) {
    console.log('channel');
    return conn.createChannel();
  }).then(function(ch) {
    console.log('exchange');
    channel = ch;
    return _assertRoute(exchangeRoute, channel);
  }).then(function(topologyNames) {
    console.log('queue');
    exchangeName = topologyNames.exchangeName;
    return _assertRoute(queueRoute, channel);
  }).then(function(topologyNames) {
    queueName = topologyNames.queueName;
    console.log('binding');
    return channel.bindQueue(queueName, exchangeName, connection.pattern);
  });
};
