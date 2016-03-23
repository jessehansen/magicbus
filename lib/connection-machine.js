'use strict';

// initial version from https://github.com/LeanKit-Labs/wascally

const Monologue = require('monologue.js');
const Promise = require('bluebird');
const DeferredPromise = require('./deferred-promise');
const machina = require('machina');

module.exports = function CreateConnectionMachine(options, logger, connectionFactory, channelFactory) {
  let ChannelFactory = channelFactory || require('./amqp/channel');
  let ConnectionFactory = connectionFactory || require('./amqp/connection');

  let connection;
  let queues = [];
  let exchanges = [];
  let cLog = logger.scoped('connection');


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
    _closer: function() {
      connection.close().then(() => {
        this.transition('closed');
      });
    },

    /**
     * Adds queue to queues collection
     *
     * @public
     * @memberOf ConnectionMachine.prototype
     */
    addQueue: function(queue) {
      queues.push(queue);
    },

    /**
     * Adds exchange to exchanges collection
     *
     * @public
     * @memberOf ConnectionMachine.prototype
     */
    addExchange: function(exchange) {
      exchanges.push(exchange);
    },

    /**
     * Closes connection
     *
     * @public
     * @memberOf ConnectionMachine.prototype
     * @returns {Promise} promise that is fulfilled after connection has been closed
     */
    close: function(reset) {
      var deferred = DeferredPromise();
      this.handle('close', deferred);
      return deferred.promise.then(() => {
        if (reset) {
          queues = [];
          exchanges = [];
        }
      });
    },

    /**
     * Creates a new channel
     *
     * @public
     * @memberOf ConnectionMachine.prototype
     * @returns {ChannelMachine} the resulting channel
     */
    createChannel: function(confirm) {
      this.connect();
      return ChannelFactory.create(connection, confirm, logger);
    },

    /**
     * Moves the connection into connected state
     *
     * @public
     * @memberOf ConnectionMachine.prototype
     * @returns {Promise} a promise that is fulfilled when the connection is connected
     */
    connect: function() {
      var deferred = DeferredPromise();
      this.handle('connect', deferred);
      return deferred.promise;
    },

    /**
     * Gets the last error from the connection
     *
     * @public
     * @memberOf ConnectionMachine.prototype
     * @returns {Error} the last error, or undefined
     */
    lastError: function() {
      return connection.lastError;
    },

    /**
     * Create a function to replay an event on the connection
     *
     * @public
     * @memberOf ConnectionMachine.prototype
     * @param {String} ev - event
     * @returns {Function} a function that can be called to replay the connection event
     */
    replay: function(ev) {
      return (x) => {
        this.emit(ev, x);
        this.handle(ev, x);
      };
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
      'initializing': {
        _onEnter: function() {
          connection = ConnectionFactory(options, logger);
          connection.on('acquiring', this.replay('acquiring'));
          connection.on('acquired', this.replay('acquired'));
          connection.on('failed', this.replay('failed'));
          connection.on('lost', this.replay('lost'));
        },
        'acquiring': function() {
          this.transition('connecting');
        },
        'acquired': function() {
          this.transition('connected');
        },
        'close': function() {
          this.deferUntilTransition('connected');
          this.transition('connected');
        },
        'connect': function() {
          this.deferUntilTransition('connected');
          this.transition('connecting');
        },
        'failed': function(err) {
          this.transition('failed');
          this.emit('failed', err);
        }
      },
      /**
       * Represents state where connection is desired, but not available yet
       * @memberOf ConnectionMachine.prototype.states
       */
      'connecting': {
        _onEnter: function() {
          setTimeout(function() {
            connection.acquire();
          }, 0);
        },
        'acquired': function() {
          this.transition('connected');
        },
        'close': function() {
          this.deferUntilTransition('connected');
          this.transition('connected');
        },
        'connect': function() {
          this.deferUntilTransition('connected');
        },
        'failed': function(err) {
          this.transition('failed');
          this.emit('failed', err);
        }
      },
      /**
       * Represents connected state
       * @memberOf ConnectionMachine.prototype.states
       */
      'connected': {
        _onEnter: function() {
          if (this.reconnected) {
            this.emit('reconnected');
          }
          this.reconnected = true;
          this.emit('connected', connection);
        },
        'failed': function(err) {
          this.emit('failed', err);
          this.transition('connecting');
        },
        'lost': function() {
          this.transition('connecting');
        },
        'close': function() {
          this.deferUntilTransition('closed');
          this.transition('closing');
        },
        'connect': function(deferred) {
          deferred.resolve();
          this.emit('already-connected', connection);
        }
      },
      /**
       * Represents disconnected state (due to requested connection close)
       * @memberOf ConnectionMachine.prototype.states
       */
      'closed': {
        _onEnter: function() {
          cLog.info(`Closed connection to ${this.name}`);
          this.emit('closed', {});
        },
        'acquiring': function() {
          this.transition('connecting');
        },
        'close': function(deferred) {
          deferred.resolve();
          connection.release();
          this.emit('closed');
        },
        'connect': function() {
          this.deferUntilTransition('connected');
          this.transition('connecting');
        },
        'failed': function(err) {
          this.emit('failed', err);
        }
      },
      /**
       * Represents state where connection closure is desired but not complete
       * @memberOf ConnectionMachine.prototype.states
       */
      'closing': {
        _onEnter: function() {
          var closeList = queues.concat(exchanges);
          if (closeList.length) {
            Promise.map(closeList, (channel) => {
              return channel.destroy();
            }).then(() => {
              this._closer();
            });
          } else {
            this._closer();
          }
        },
        'connect': function() {
          this.deferUntilTransition('closed');
        },
        close: function() {
          this.deferUntilTransition('closed');
        }
      },
      /**
       * Represents state where connection attempt has failed
       * @memberOf ConnectionMachine.prototype.states
       */
      'failed': {
        'close': function(deferred) {
          deferred.resolve();
          connection.destroy();
          this.emit('closed');
        },
        'connect': function() {
          this.deferUntilTransition('connected');
          this.transition('connecting');
        }
      }
    }
  });

  Monologue.mixInto(ConnectionMachine);
  return new ConnectionMachine();
};
