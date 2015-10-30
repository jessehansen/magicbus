'use strict';

var assert = require('assert-plus');
var Promise = require('bluebird');
var amqpUri = require('amqp-uri');

module.exports = Binder;

/**
 * Binds a publishing route to a consuming route
 *
 * @public
 * @constructor
 * @param {Object} connectionInfo - connection info to be passed to amqp-uri
 * @param {String} connectionInfo.host - host name
 * @param {String} connectionInfo.vhost - vhost (default /)
 * @param {String} connectionInfo.user - user name (default guest)
 * @param {String} connectionInfo.pass - password (default guest)
 */
function Binder(connectionInfo) {
  assert.object(connectionInfo, 'connectionInfo');
  this._connectionInfo = connectionInfo;

  //Hold a reference on the instance so it can be replaced by a mock in tests
  this._amqp = require('amqplib');
}

function _assertRoute(route, channel) {
  return route.pattern.assertRoute(route.serviceDomainName, route.appName, route.name, channel);
}

Binder.prototype._createConnection = function Binder$_createConnection() {
  var self = this;

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

/**
 * Bind a publishing route to a consuming route
 *
 * @public
 * @method
 * @param {Object} publishingRoute - exchange route (required)
 * @param {Object} consumingRoute - consuming route (required)
 * @param {Object} options - binding configuration (required)
 * @param {String} options.pattern - routing pattern (ex: "#")
 * @returns {Promise} a promise that is fulfilled when the bind is finished
 */
Binder.prototype.bind = function Binder$bind(publishingRoute, consumingRoute, options) {
  var channel, exchangeName, queueName;

  return this._createConnection().then(function(conn) {
    return conn.createChannel();
  }).then(function(ch) {
    channel = ch;
    return _assertRoute(publishingRoute, channel);
  }).then(function(topologyNames) {
    exchangeName = topologyNames.exchangeName;
    return _assertRoute(consumingRoute, channel);
  }).then(function(topologyNames) {
    queueName = topologyNames.queueName;
    return channel.bindQueue(queueName, exchangeName, options.pattern);
  });
};
