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
  logger = logger.scoped('queue-machine');

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
    subscriptions: [],

    /**
     * Defines queue
     * @memberOf QueueMachine.prototype
     */
    define: function() {
      return this.channel.define();
    },

    /**
     * Returns a promise that is fulfilled or rejected when the channel is defined and ready or failed
     *
     * @public
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
          this.subscriptions = [];
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
     * @param {Object} options - details in consuming from the queue
     * @param {Number} options.limit - the channel prefetch limit
     * @param {bool} options.noBatch - if true, ack/nack/reject operations will execure immediately and not be batched
     * @param {bool} options.noAck - if true, the broker won't expect an acknowledgement of messages delivered to this consumer; i.e., it will dequeue messages as soon as they've been sent down the wire. Defaults to false (i.e., you will be expected to acknowledge messages).
     * @param {String} options.consumerTag - a name which the server will use to distinguish message deliveries for the consumer; mustn't be already in use on the channel. It's usually easier to omit this, in which case the server will create a random name and supply it in the reply.
     * @param {bool} options.exclusive - if true, the broker won't let anyone else consume from this queue; if there already is a consumer, there goes your channel (so usually only useful if you've made a 'private' queue by letting the server choose its name).
     * @param {Number} options.priority - gives a priority to the consumer; higher priority consumers get messages in preference to lower priority consumers. See this RabbitMQ extension's documentation
     * @param {Object} options.arguments -  arbitrary arguments. Go to town.
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

    /**
     * Restarts any subscriptions (called upon reconnect)
     */
    resubscribe: function() {
      if (this.subscriptions.length) {
        return Promise.map(this.subscriptions, (op) => {
          return op();
        })
        .then(() => {
          logger.info(`Restarted ${this.subscriptions.length} subscriptions`);
        });
      }
      return Promise.resolve();
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
          this.handlers = [];
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
          this.channel.channel.once('released', () => {
            logger.info(`Queue ${options.name} - ${connection.name} channel released`);
            this.handle('released');
          });
          this.define()
            .then(() => {
              return this.resubscribe();
            })
            .then(() => {
              this.transition('ready');
            })
            .catch((err) => {
              logger.error(`Failed to define or resubscribe to queue ${this.name} - ${connection.name}`, err);
              this.transition('failed');
            });
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
              this.subscriptions.push(op);
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
  queueMachine.on('transition', (data) => {
    logger.debug(`Machine queue-${options.name}: ${data.fromState} -> ${data.toState}`);
  });
  return queueMachine;
};
