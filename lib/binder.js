'use strict';

var assert = require('assert-plus');
var Promise = require('bluebird');
var _ = require('lodash');

module.exports = Binder;

function fixConnectionInfo(connectionInfo) {
  var cxn = _.cloneDeep(connectionInfo);
  if (cxn.user && cxn.password) {
    cxn.username = cxn.user;
    delete cxn.user;
  }
  if (cxn.host) {
    cxn.hostname = cxn.host;
    delete cxn.host;
  }
  return cxn;
}

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
function Binder(amqp, connectionInfo) {
  assert.object(amqp, 'amqp');

  this._amqp = amqp;

  if (typeof(connectionInfo) !== 'string') {
    assert.object(connectionInfo, 'connectionInfo');
    this._connectionInfo = fixConnectionInfo(connectionInfo);
  }
  else {
    this._connectionInfo = connectionInfo;
  }
}

function _assertRoute(route, channel) {
  return route.pattern.assertRoute(route.serviceDomainName, route.appName, route.name, channel);
}

Binder.prototype._createConnection = function Binder$_createConnection() {
  var self = this;

  if (self._connection) {
    return Promise.resolve(self._connection);
  } else {
    return self._amqp.connect(self._connectionInfo).then(function(conn) {
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
