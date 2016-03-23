'use strict';

const _ = require('lodash');
const assert = require('assert-plus');
const Connection = require('./connection-machine');
const Topology = require('./topology');

/**
 * Creates a binder which can be used to bind a publishing route to a consuming route, mainly for use across service domains
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
function Binder(connectionInfo, logger) {
  let topology;
  if (typeof(connectionInfo) !== 'string') {
    assert.object(connectionInfo, 'connectionInfo');
  }
  assert.object(logger, 'logger');

  /**
   * Ensures the topology is created for a route
   * @private
   * @param {Object} route - the route
   * @returns {Promise} a promise that is fulfilled with the resulting topology names after the topology has been created
   */
  const createTopology = (route) => {
    logger.debug(`Asserting topology for route ${route.name}`);
    return route.pattern.createTopology(topology, route.serviceDomainName, route.appName, route.name);
  };

  /**
   * Ensures a connection has been opened
   * @private
   */
  const connect = () => {
    if (!topology) {
      let connectionOptions = _.extend({
        name: 'binder'
      }, connectionInfo);
      let connection = Connection(connectionOptions, logger);
      topology = Topology(connection, logger);
      connection.on('connected', (state) => {
        connection.uri = state.item.uri;
        logger.info(`Connected to ${state.item.uri} Successfully`);
      });
      connection.on('closed', () => {
        logger.info('Connection closed');
      });
      connection.on('failed', (err) => {
        logger.error('Error connecting', err);
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
  const bind = (publishingRoute, consumingRoute, options) => {
    let exchangeName;
    let queueName;
    connect();

    return createTopology(publishingRoute)
    .then((topologyNames) => {
      exchangeName = topologyNames.exchangeName;
      return createTopology(consumingRoute);
    }).then((topologyNames) => {
      queueName = topologyNames.queueName;
      logger.info('Binding "' + exchangeName + '" to "' + queueName + '" with pattern "' + options.pattern + '"');
      return topology.createBinding({
        source: exchangeName,
        target: queueName,
        queue: true,
        keys: [options.pattern]
      });
    });
  };

  return { bind: bind };
}

module.exports = Binder;
