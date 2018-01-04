
const assert = require('assert-plus')

/**
 * Creates a binder which can be used to bind a publishing route to a consuming route, mainly for use across
    service domains
 *
 * @public
 * @constructor
 * @param {Object} topology - connected rabbitmq topology
 * @param {Object} logger - the logger
 */
function Binder (topology, logger) {
  assert.object(topology, 'topology')
  assert.object(logger, 'logger')

  let closed = false

  /**
   * Ensures the topology is created for a route
   * @private
   * @param {Object} route - the route
   * @returns {Promise} a promise that is fulfilled with the resulting topology names after the topology has been
        created
   */
  const createTopology = (route) => {
    logger.silly(`Asserting topology for route ${route.name}`)
    return route.pattern.createTopology(topology, route.serviceDomainName, route.appName, route.name)
  }

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
    let exchangeName
    let queueName

    return createTopology(publishingRoute)
      .then((topologyNames) => {
        exchangeName = topologyNames.exchangeName
        return createTopology(consumingRoute)
      }).then((topologyNames) => {
        queueName = topologyNames.queueName
        logger.info('Binding "' + exchangeName + '" to "' + queueName + '" with pattern "' + options.pattern + '"')
        return topology.createBinding({
          source: exchangeName,
          target: queueName,
          queue: true,
          keys: [options.pattern]
        })
      })
  }

  /**
   * Checks to see if a connection is established.
   *
   * @public
   * @method
   * @memberof Broker.prototype
   * @returns {Boolean} status of the connection
   */
  const isConnected = () => !!topology && !closed

  /**
   * Close the connection and all associated channels
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @returns {Promise} a promise that is fulfilled when the shutdown is complete
   */
  const shutdown = () => {
    if (closed) {
      return Promise.resolve()
    }
    closed = true
    logger.info('Shutting down binder connection')
    if (topology) {
      return topology.connection.close(true).then(function () {
        topology = null
      })
    }
    return Promise.resolve()
  }

  return { bind, isConnected, shutdown }
}

module.exports = Binder
