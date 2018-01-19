const Binder = (topology, logger) => {
  let closed = false

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
  const bind = ({ source, target, queue = true, keys = [''] }) => {
    logger.info(`Binding "${source}" to "${target}" (${queue ? 'queue' : 'exchange'}) with pattern "${keys[0]}"`)
    return topology.createBinding({
      source,
      target,
      queue,
      keys
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
  const isConnected = () => !closed

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
    return topology.connection.close(true).then(() => {
      topology = null
    })
  }

  return { bind, isConnected, shutdown }
}

module.exports = Binder
