'use strict';
// initial version from https://github.com/LeanKit-Labs/wascally

const _ = require('lodash');
const Promise = require('bluebird');
const DeferredPromise = require('./deferred-promise');
const machina = require('machina');
const Monologue = require('monologue.js');

/**
 * Creates a queue state machine that (re)connects consumers upon connection
 * @param {Object} options - the options passed to queueFactory
 * @param {bool} options.noAck - true if the queue should be in untracked mode
 * @param {Object} connection - the connection
 * @param {Object} topology - connection topology
 * @param {Object} logger - the logger
 * @param {Function} queueFactory - factory function that takes the options, topology, and the logger to create a Queue
 * @returns {QueueMachine}
 */
module.exports = function CreateQueueMachine(options, connection, topology, logger, queueFactory) {
  let QueueFactory = queueFactory || require('./amqp/queue');

  /**
   * State Machine representing a rabbitmq queue, with states around connection and definition
   * @class QueueMachine
   * @private
   */
  const QueueMachine = machina.Fsm.extend({
    name: options.name,
    channel: undefined,
    responseSubscriptions: {},
    signalSubscription: undefined,
    handlers: [],

    /**
     * Returns a promise that is fulfilled or rejected when the channel is defined and ready or failed
     *
     * @private
     * @memberOf QueueMachine.prototype
     * @returns {Promise}
     */
    check: function() {
      let deferred = DeferredPromise();
      this.handle('check', deferred);
      return deferred.promise;
    },

    /**
     * Destroy the queue
     *
     * @public
     * @memberOf QueueMachine.prototype
     * @returns {Promise} a promise that is fulfilled when destruction is complete
     */
    destroy: function() {
      return new Promise((resolve) => {
        logger.debug(`Destroy called on queue ${this.name} - ${connection.name} (${this.channel.getMessageCount()} messages pending)`);
        this.on('destroyed', () => {
          resolve();
        }).once();
        this.handle('destroy');
      });
    },

    /**
     * Subscribe to the queue
     *
     * @public
     * @memberOf QueueMachine.prototype
     * @param {Function} callback - the function to be called with each message
     * @param {Object} options - subscription options, passed to Queue.subscribe
     * @returns {Promise} a promise that is fulfilled when the subscription is active
     */
    subscribe: function(callback, options) {
      return new Promise((resolve, reject) => {
        let op = () => {
          return this.channel.subscribe(callback, options)
            .then(resolve, reject);
        };
        this.on('failed', function(err) {
          reject(err);
        }).once();
        this.handle('subscribe', op);
      });
    },

    /**
     * Purge all messages from the queue
     *
     * @public
     * @memberOf QueueMachine.prototype
     * @returns {Promise} a promise that is fulfilled when the purge is complete
     */
    purge: function() {
      let deferred = DeferredPromise();
      this.handle('purge', deferred);
      return deferred.promise;
    },

    initialState: 'initializing',

    /**
     * States and transitions
     *
     * @public
     * @memberOf QueueMachine.prototype
     */
    states: {
      /**
       * Destruction of queue has been requested. Transitions to destroyed after queue is destroyed
       * @memberOf QueueMachine.prototype.states
       */
      'destroying': {
        _onEnter: function() {
          _.each(this.handlers, (handle) => {
            handle.unsubscribe();
          });
          this.channel.destroy()
            .then(() => {
              if (this.channel.getMessageCount() > 0) {
                logger.warn(`!!! Queue ${options.name} - ${connection.name} was destroyed with ${this.channel.getMessageCount()} pending messages !!!`);
              } else {
                logger.info(`Destroyed queue ${options.name} - ${connection.name}`);
              }
              this.transition('destroyed');
              this.channel = undefined;
            });
        },
        destroy: function() {
          this.deferUntilTransition('destroyed');
        },
        check: function() {
          this.deferUntilTransition('destroyed');
        },
        purge: function() {
          this.deferUntilTransition('destroyed');
        }
      },
      /**
       * Destruction of queue is complete
       * @memberOf QueueMachine.prototype.states
       */
      'destroyed': {
        _onEnter: function() {
          this.emit('destroyed');
        },
        destroy: function() {
          this.emit('destroyed');
        },
        check: function() {
          this.deferUntilTransition('ready');
          this.transition('initializing');
        },
        purge: function() {
          this.deferUntilTransition('ready');
          this.transition('initializing');
        }
      },
      /**
       * Connection/opening channel has failed
       * @memberOf QueueMachine.prototype.states
       */
      'failed': {
        _onEnter: function() {
          this.emit('failed', this.failedWith);
          this.channel = undefined;
        },
        check: function(deferred) {
          if(deferred) {
            deferred.reject(this.failedWith);
          }
        },
        destroy: function() {
          this.deferUntilTransition('ready');
        },
        subscribe: function() {
          this.emit('failed', this.failedWith);
        },
        purge: function(deferred) {
          if(deferred) {
            deferred.reject(this.failedWith);
          }
        }
      },
      /**
       * Initial state - transitions to ready or failed upon connection/failure
       * @memberOf QueueMachine.prototype.states
       */
      'initializing': {
        _onEnter: function() {
          this.channel = QueueFactory(options, topology, logger);
          const onError = (err) => {
            this.failedWith = err;
            this.transition('failed');
          };
          const onDefined = () => {
            this.transition('ready');
          };
          this.channel.define()
            .then(onDefined, onError);
          this.handlers.push(this.channel.channel.on('released', () => {
            logger.info(`Queue ${options.name} - ${connection.name} channel released`);
            this.handle('released');
          }));
        },
        check: function() {
          this.deferUntilTransition('ready');
        },
        destroy: function() {
          this.deferUntilTransition('ready');
        },
        released: function() {
          this.channel.destroy(true);
          this.transition('initializing');
        },
        subscribe: function() {
          this.deferUntilTransition('ready');
        },
        purge: function() {
          this.deferUntilTransition('ready');
        }
      },
      /**
       * Channel is open and ready for action
       * @memberOf QueueMachine.prototype.states
       */
      'ready': {
        _onEnter: function() {
          this.emit('defined');
        },
        check: function(deferred) {
          deferred.resolve();
        },
        destroy: function() {
          this.transition('destroying');
        },
        released: function() {
          this.channel.destroy(true);
          this.transition('initializing');
        },
        subscribe: function(op) {
          op()
            .then(() => {
              logger.info(`Subscription to (${options.noAck ? 'untracked' : 'tracked'}) queue ${options.name} - ${connection.name} started with consumer tag ${this.channel && this.channel.channel ? this.channel.channel.tag : ''}`);
            });
        },
        purge: function(deferred) {
          this.channel.purge().then(deferred.resolve);
        }
      }
    }
  });

  Monologue.mixInto(QueueMachine);
  let queueMachine = new QueueMachine();
  queueMachine.receivedMessages = queueMachine.channel.messages;
  connection.addQueue(queueMachine);
  return queueMachine;
};
