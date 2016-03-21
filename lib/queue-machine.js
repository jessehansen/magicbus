// initial version from https://github.com/LeanKit-Labs/wascally

var _ = require('lodash');
var Promise = require('bluebird');
var DeferredPromise = require('./deferred-promise');
var machina = require('machina');
var Monologue = require('monologue.js');
Monologue.mixInto(machina.Fsm);

var Channel = function(options, connection, topology, logger, channelFn) {

  // allows us to optionally provide a mock
  channelFn = channelFn || require('./amqp/queue');

  var Fsm = machina.Fsm.extend({
    name: options.name,
    channel: undefined,
    responseSubscriptions: {},
    signalSubscription: undefined,
    handlers: [],

    check: function() {
      var deferred = DeferredPromise();
      this.handle('check', deferred);
      return deferred.promise;
    },

    destroy: function() {
      return new Promise(function(resolve) {
        logger.debug(`Destroy called on queue ${this.name} - ${connection.name} (${this.channel.getMessageCount()} messages pending)`);
        this.on('destroyed', function() {
          resolve();
        }).once();
        this.handle('destroy');
      }.bind(this));
    },

    subscribe: function(callback, options) {
      return new Promise(function(resolve, reject) {
        var op = function() {
          return this.channel.subscribe(callback, options)
            .then(resolve, reject);
        }.bind(this);
        this.on('failed', function(err) {
          reject(err);
        }).once();
        this.handle('subscribe', op);
      }.bind(this));
    },

    drain: function() {
      var deferred = DeferredPromise();
      this.handle('drain', deferred);
      return deferred.promise;
    },

    initialState: 'initializing',
    states: {
      'destroying': {
        _onEnter: function() {
          _.each(this.handlers, function(handle) {
            handle.unsubscribe();
          });
          this.channel.destroy()
            .then(function() {
              if (this.channel.getMessageCount() > 0) {
                logger.warn(`!!! Queue ${options.name} - ${connection.name} was destroyed with ${this.channel.getMessageCount()} pending messages !!!`);
              } else {
                logger.info(`Destroyed queue ${options.name} - ${connection.name}`);
              }
              this.transition('destroyed');
              this.channel = undefined;
            }.bind(this));
        },
        destroy: function() {
          this.deferUntilTransition('destroyed');
        },
        check: function() {
          this.deferUntilTransition('destroyed');
        },
        drain: function() {
          this.deferUntilTransition('destroyed');
        }
      },
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
        drain: function() {
          this.deferUntilTransition('ready');
          this.transition('initializing');
        }
      },
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
        drain: function(deferred) {
          if(deferred) {
            deferred.reject(this.failedWith);
          }
        }
      },
      'initializing': {
        _onEnter: function() {
          this.channel = channelFn(options, topology, logger);
          var onError = function(err) {
            this.failedWith = err;
            this.transition('failed');
          }.bind(this);
          var onDefined = function() {
            this.transition('ready');
          }.bind(this);
          this.channel.define()
            .then(onDefined, onError);
          this.handlers.push(this.channel.channel.on('released', function() {
            logger.info(`Queue ${options.name} - ${connection.name} channel released`);
            this.handle('released');
          }.bind(this)));
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
        drain: function() {
          this.deferUntilTransition('ready');
        }
      },
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
            .then(function() {
              logger.info(`Subscription to (${options.noAck ? 'untracked' : 'tracked'}) queue ${options.name} - ${connection.name} started with consumer tag ${this.channel && this.channel.channel ? this.channel.channel.tag : ''}`);
            }.bind(this));
        },
        drain: function(deferred) {
          this.channel.drain().then(deferred.resolve);
        }
      }
    }
  });

  var fsm = new Fsm();
  fsm.receivedMessages = fsm.channel.messages;
  connection.addQueue(fsm);
  return fsm;
};

module.exports = Channel;
