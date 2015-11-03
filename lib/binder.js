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
function Binder(amqp, connectionInfo, logger) {
  assert.object(amqp, 'amqp');
  assert.object(connectionInfo, 'connectionInfo');
  assert.object(logger, 'logger');

  this._amqp = amqp;
  this._connectionInfo = connectionInfo;
  this._logger = logger;
}

Binder.prototype._assertRoute = function Binder$_assertRoute(route, channel) {
  this._logger.debug('Asserting route ' + route.name);
  return route.pattern.assertRoute(route.serviceDomainName, route.appName, route.name, channel);
};

Binder.prototype._createConnection = function Binder$_createConnection() {
  var self = this;

  if (self._connection) {
    return Promise.resolve(self._connection);
  } else {
    var connectionString = amqpUri(self._connectionInfo);
    this._logger.debug('Connecting to ' + connectionString);
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
  var self = this;

  return this._createConnection().then(function(conn) {
    return conn.createChannel();
  }).then(function(ch) {
    channel = ch;
    return self._assertRoute(publishingRoute, channel);
  }).then(function(topologyNames) {
    exchangeName = topologyNames.exchangeName;
    return self._assertRoute(consumingRoute, channel);
  }).then(function(topologyNames) {
    queueName = topologyNames.queueName;
    self._logger.debug('Binding "' + exchangeName + '" to "' + queueName + '" with pattern "' + options.pattern + '"');
    return channel.bindQueue(queueName, exchangeName, options.pattern);
  });
};
