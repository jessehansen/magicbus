'use strict';

var _ = require('lodash');
var assert = require('assert-plus');
var Connection = require('./connection-machine');
var Topology = require('./topology');

/**
 * Binds a publishing route to a consuming route
 *
 * @public
 * @constructor
 * @param {Object} connectionInfo - connection info to be passed to amqplib's connect method
 * @param {String} connectionInfo.host - host name
 * @param {String} connectionInfo.vhost - vhost (default /)
 * @param {String} connectionInfo.user - user name (default guest)
 * @param {String} connectionInfo.pass - password (default guest)
 * @param {Object} logger - the logger
 */
function Binder(amqp, connectionInfo, logger) {
  assert.object(amqp, 'amqp');
  if (typeof(connectionInfo) !== 'string') {
    assert.object(connectionInfo, 'connectionInfo');
  }
  assert.object(logger, 'logger');

  this._amqp = amqp;
  this._connectionInfo = connectionInfo;
  this._logger = logger;
}

Binder.prototype.createTopology = function Binder$createTopology(route) {
  this._logger.debug(`Asserting topology for route ${route.name}`);
  return route.pattern.createTopology(this._topology, route.serviceDomainName, route.appName, route.name);
};

Binder.prototype.connect = function Binder$connect() {
  var self = this;
  var connectionOptions, connection, topology;
  if (!this._topology) {
    connectionOptions = _.extend({
      name: 'binder'
    }, this._connectionInfo);
    connection = Connection(connectionOptions, this._logger);
    topology = Topology(connection, this._logger);
    connection.on('connected', function(state) {
      connection.uri = state.item.uri;
      self._logger.info(`Connected to ${state.item.uri} Successfully`);
    });
    connection.on('closed', function() {
      self._logger.info('Connection closed');
    });
    connection.on('failed', function(err) {
      self._logger.error('Error connecting', err);
    });
    this._topology = topology;
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
  var exchangeName, queueName;
  var self = this;

  self.connect();

  return self.createTopology(publishingRoute)
  .then(function(topologyNames) {
    exchangeName = topologyNames.exchangeName;
    return self.createTopology(consumingRoute);
  }).then(function(topologyNames) {
    queueName = topologyNames.queueName;
    self._logger.info('Binding "' + exchangeName + '" to "' + queueName + '" with pattern "' + options.pattern + '"');
    return self._topology.createBinding({
      source: exchangeName,
      target: queueName,
      queue: true,
      keys: [options.pattern]
    });
  });
};

module.exports = Binder;
