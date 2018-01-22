// initial version from https://github.com/LeanKit-Labs/wascally
const Monologue = require('monologue.js')
const DeferredPromise = require('./deferred-promise')
const machina = require('machina')

/**
 * Creates a connection machine instance
 * @param {Object} options - the options passed to connectionFactory
 * @param {String} options.name - connection name
 * @param {String} options.server - list of servers to connect to, separated by ','
 * @param {String} options.port - list of ports to connect to, separated by ','. Must have the same number of
      entries as options.server
 * @param {Number} options.heartbeat - heartbeat timer - defaults to 30 seconds
 * @param {String} options.protocol - connection protocol - defaults to amqp:// or amqps://
 * @param {String} options.user - user name - defaults to guest
 * @param {String} options.pass - password - defaults to guest
 * @param {String} options.vhost - vhost to connect to - defaults to '/'
 * @param {String} options.timeout - connection timeout
 * @param {String} options.certPath - certificate file path (for SSL)
 * @param {String} options.keyPath - key file path (for SSL)
 * @param {String} options.caPath - certificate file path(s), separated by ',' (for SSL)
 * @param {String} options.passphrase - certificate passphrase (for SSL)
 * @param {String} options.pfxPath - pfx file path (for SSL)
 * @param {Object} logger - the logger
 * @param {Function} connectionFactory - factory function that takes the options and the logger to create a Connection
 * @param {Function} channelFactory - factory function that takes a connection, whether the channel should be a
      confirmChannel, and the logger and returns a ChannelMachine
 * @returns {ConnectionMachine}
 */
const createConnectionMachine = (options, logger, connectionFactory, channelFactory) => {
  let ConnectionFactory = connectionFactory || require('./amqp/connection')
  let ChannelFactory = channelFactory || require('./amqp/channel')

  let connection
  let queues = []
  let exchanges = []
  let cLog = logger.withNamespace('connection')

  /**
   * Represents a connection to rabbitmq, handling connect/reconnect logic
   * @class ConnectionMachine
   * @private
   */
  const ConnectionMachine = machina.Fsm.extend({
    name: options.name || 'default',
    initialState: 'initializing',
    reconnected: false,

    /**
     * Closes connection
     *
     * @private
     * @memberOf ConnectionMachine.prototype
     */
    doClose: function () {
      connection.close().then(() => {
        this.transition('closed')
      })
    },

    /**
     * Adds queue to queues collection
     *
     * @public
     * @memberOf ConnectionMachine.prototype
     */
    addQueue: function (queue) {
      queues.push(queue)
    },

    /**
     * Adds exchange to exchanges collection
     *
     * @public
     * @memberOf ConnectionMachine.prototype
     */
    addExchange: function (exchange) {
      exchanges.push(exchange)
    },

    /**
     * Closes connection
     *
     * @public
     * @memberOf ConnectionMachine.prototype
     * @returns {Promise} promise that is fulfilled after connection has been closed
     */
    close: function (reset) {
      let deferred = DeferredPromise()
      this.handle('close', deferred)
      return deferred.promise.then(() => {
        if (reset) {
          queues = []
          exchanges = []
        }
      })
    },

    /**
     * Creates a new channel
     *
     * @public
     * @memberOf ConnectionMachine.prototype
     * @returns {ChannelMachine} the resulting channel
     */
    createChannel: function (confirm) {
      this.connect()
      return ChannelFactory(connection, confirm, logger)
    },

    /**
     * Moves the connection into connected state
     *
     * @public
     * @memberOf ConnectionMachine.prototype
     * @returns {Promise} a promise that is fulfilled when the connection is connected
     */
    connect: function () {
      let deferred = DeferredPromise()
      this.handle('connect', deferred)
      return deferred.promise
    },

    /**
     * Gets the last error from the connection
     *
     * @public
     * @memberOf ConnectionMachine.prototype
     * @returns {Error} the last error, or undefined
     */
    lastError: function () {
      return connection.lastError
    },

    /**
     * Create a function to replay an event on the connection
     *
     * @public
     * @memberOf ConnectionMachine.prototype
     * @param {String} ev - event
     * @returns {Function} a function that can be called to replay the connection event
     */
    replay: function (ev) {
      return (x) => {
        this.emit(ev, x)
        this.handle(ev, x)
      }
    },

    /**
     * States and transitions
     *
     * @public
     * @memberOf ConnectionMachine.prototype
     */
    states: {
      /**
       * Initial state - sets up connection impelmentation and state changes
       * @memberOf ConnectionMachine.prototype.states
       */
      initializing: {
        _onEnter: function () {
          connection = ConnectionFactory(options, logger)
          connection.on('acquiring', this.replay('acquiring'))
          connection.on('acquired', this.replay('acquired'))
          connection.on('failed', this.replay('failed'))
          connection.on('lost', this.replay('lost'))
        },
        acquiring: function () {
          this.transition('connecting')
        },
        acquired: function () {
          this.transition('connected')
        },
        close: function () {
          this.deferUntilTransition('connected')
          this.transition('connected')
        },
        connect: function () {
          this.deferUntilTransition('connected')
          this.transition('connecting')
        },
        failed: function (err) {
          this.transition('failed')
          this.emit('failed', err)
        }
      },
      /**
       * Represents state where connection is desired, but not available yet
       * @memberOf ConnectionMachine.prototype.states
       */
      connecting: {
        _onEnter: function () {
          process.nextTick(() => connection.acquire())
        },
        acquired: function () {
          this.transition('connected')
        },
        close: function () {
          this.deferUntilTransition('connected')
          this.transition('connected')
        },
        connect: function () {
          this.deferUntilTransition('connected')
        },
        failed: function (err) {
          this.transition('failed')
          this.emit('failed', err)
        }
      },
      /**
       * Represents connected state
       * @memberOf ConnectionMachine.prototype.states
       */
      connected: {
        _onEnter: function () {
          if (this.reconnected) {
            this.emit('reconnected')
          }
          this.reconnected = true
          this.emit('connected', connection)
        },
        failed: function (err) {
          this.emit('failed', err)
          this.transition('connecting')
        },
        lost: function () {
          this.transition('connecting')
        },
        close: function () {
          this.deferUntilTransition('closed')
          this.transition('closing')
        },
        connect: function (deferred) {
          deferred.resolve()
          this.emit('already-connected', connection)
        }
      },
      /**
       * Represents disconnected state (due to requested connection close)
       * @memberOf ConnectionMachine.prototype.states
       */
      closed: {
        _onEnter: function () {
          cLog.info(`Closed connection to ${this.name}`)
          this.emit('closed', {})
        },
        acquiring: function () {
          this.transition('connecting')
        },
        close: function (deferred) {
          deferred.resolve()
          connection.release()
          this.emit('closed')
        },
        connect: function () {
          this.deferUntilTransition('connected')
          this.transition('connecting')
        },
        failed: function (err) {
          this.emit('failed', err)
        }
      },
      /**
       * Represents state where connection closure is desired but not complete
       * @memberOf ConnectionMachine.prototype.states
       */
      closing: {
        _onEnter: function () {
          let closeList = queues.concat(exchanges)
          if (closeList.length > 0) {
            Promise.all(closeList.map((channel) => channel.destroy()))
              .then(() => {
                this.doClose()
              })
          } else {
            this.doClose()
          }
        },
        connect: function () {
          this.deferUntilTransition('closed')
        },
        close: function () {
          this.deferUntilTransition('closed')
        }
      },
      /**
       * Represents state where connection attempt has failed
       * @memberOf ConnectionMachine.prototype.states
       */
      failed: {
        close: function (deferred) {
          deferred.resolve()
          connection.destroy()
          this.emit('closed')
        },
        connect: function () {
          this.deferUntilTransition('connected')
          this.transition('connecting')
        },
        acquired: function () {
          this.transition('connected')
        }
      }
    }
  })

  Monologue.mixInto(ConnectionMachine)
  let machine = new ConnectionMachine()
  machine.on('transition', (data) => {
    logger.debug(`Machine connection ${machine.name}: ${data.fromState} -> ${data.toState}`)
  })
  return machine
}

module.exports = createConnectionMachine
