'use strict';
// initial version from https://github.com/LeanKit-Labs/wascally
var _ = require('lodash');
var Promise = require('bluebird');
var DeferredPromise = require('./deferred-promise');
var machina = require('machina');
var Monologue = require('monologue.js');
var publishLog = require('./publish-log');

function Channel(options, connection, topology, logger, channelFn) {
  var Fsm, fsm;
  // allows us to optionally provide a mock
  channelFn = channelFn || require('./amqp/exchange');

  /* eslint no-invalid-this: 1 */
  Fsm = machina.Fsm.extend({
    name: options.name,
    type: options.type,
    channel: undefined,
    handlers: [],
    deferred: [],
    published: publishLog(),

    _define: function(stateOnDefined) {
      function onDefinitionError(err) {
        this.failedWith = err;
        this.transition('failed');
      }
      function onDefined() {
        this.transition(stateOnDefined);
      }
      this.channel.define()
        .then(onDefined.bind(this), onDefinitionError.bind(this));
    },

    _listen: function() {
      this.handlers.push(topology.on('bindings-completed', function() {
        this.handle('bindings-completed');
      }.bind(this)));
      this.handlers.push(connection.on('reconnected', function() {
        this.transition('reconnecting');
      }.bind(this)));
      this.handlers.push(this.on('failed', function(err) {
        _.each(this.deferred, function(x) {
          x(err);
        });
        this.deferred = [];
      }.bind(this)));
    },

    _removeDeferred: function(reject) {
      var index = _.indexOf(this.deferred, reject);
      if (index >= 0) {
        this.deferred.splice(index, 1);
      }
    },

    check: function() {
      var deferred = DeferredPromise();
      this.handle('check', deferred);
      return deferred.promise;
    },

    destroy: function() {
      var deferred = DeferredPromise();
      logger.debug(`Destroy called on exchange ${this.name} - ${connection.name} (${this.published.count()} messages pending)`);
      this.handle('destroy', deferred);
      return deferred.promise;
    },

    publish: function(message) {
      var op;
      var publishTimeout = message.timeout || options.publishTimeout || message.connectionPublishTimeout || 0;
      logger.info(`Publish called in state ${this.state}`);
      return new Promise(function(resolve, reject) {
        var timeout, timedOut;
        if(publishTimeout > 0) {
          timeout = setTimeout(function() {
            timedOut = true;
            reject(new Error('Publish took longer than configured timeout'));
            this._removeDeferred(reject);
          }.bind(this), publishTimeout);
        }
        function onPublished() {
          resolve();
          this._removeDeferred(reject);
        }
        function onRejected(err) {
          reject(err);
          this._removeDeferred(reject);
        }
        op = function() {
          if(timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
          if(!timedOut) {
            return this.channel.publish(message)
              .then(onPublished.bind(this), onRejected.bind(this));
          }
          return Promise.resolve();
        }.bind(this);
        this.deferred.push(reject);
        this.handle('publish', op);
      }.bind(this));
    },

    republish: function() {
      var undelivered = this.published.reset();
      if (undelivered.length > 0) {
        return Promise.map(undelivered, this.channel.publish.bind(this.channel));
      }
      return Promise.resolve(true);
    },

    initialState: 'setup',
    states: {
      'setup': {
        _onEnter: function() {
          this._listen();
          this.transition('initializing');
        }
      },
      'destroying': {
        publish: function() {
          this.deferUntilTransition('destroyed');
        },
        destroy: function() {
          this.deferUntilTransition('destroyed');
        }
      },
      'destroyed': {
        _onEnter: function() {
          if (this.published.count() > 0) {
            logger.warn(`${this.type} exchange ${this.name} - ${connection.name} was destroyed with ${this.published.count()} messages unconfirmed`);
          }
          _.each(this.handlers, function(handle) {
            handle.unsubscribe();
          });
          this.channel.destroy()
            .then(function() {
              this.emit('destroyed');
              this.channel = undefined;
            }.bind(this));
        },
        'bindings-completed': function() {
          this.deferUntilTransition('reconnected');
        },
        check: function() {
          this.deferUntilTransition('ready');
        },
        destroy: function(deferred) {
          deferred.resolve();
          this.emit('destroyed');
        },
        publish: function() {
          this.transition('reconnecting');
          this.deferUntilTransition('ready');
        }
      },
      'initializing': {
        _onEnter: function() {
          this.channel = channelFn(options, topology, this.published, logger);
          this.channel.channel.once('released', function() {
            this.handle('released');
          }.bind(this));
          this._define('ready');
        },
        check: function() {
          this.deferUntilTransition('ready');
        },
        destroy: function() {
          this.deferUntilTransition('ready');
        },
        released: function() {
          this.transition('initializing');
        },
        publish: function() {
          this.deferUntilTransition('ready');
        }
      },
      'failed': {
        _onEnter: function() {
          this.emit('failed', this.failedWith);
          this.channel = undefined;
        },
        check: function(deferred) {
          deferred.reject(this.failedWith);
          this.emit('failed', this.failedWith);
        },
        destroy: function() {
          this.deferUntilTransition('ready');
        },
        publish: function() {
          this.emit('failed', this.failedWith);
        }
      },
      'ready': {
        _onEnter: function() {
          this.emit('defined');
        },
        check: function(deferred) {
          deferred.resolve();
          this.emit('defined');
        },
        destroy: function() {
          this.deferUntilTransition('destroyed');
          this.transition('destroyed');
        },
        released: function() {
          this.transition('initializing');
        },
        publish: function(op) {
          op();
        }
      },
      'reconnecting': {
        _onEnter: function() {
          this._listen();
          this.channel = channelFn(options, topology, this.published, logger);
          this._define('reconnected');
        },
        'bindings-completed': function() {
          this.deferUntilTransition('reconnected');
        },
        check: function() {
          this.deferUntilTransition('ready');
        },
        destroy: function() {
          this.deferUntilTransition('ready');
        },
        publish: function() {
          this.deferUntilTransition('ready');
        }
      },
      'reconnected': {
        _onEnter: function() {
          this.emit('defined');
        },
        'bindings-completed': function() {
          var onRepublished = function() {
            this.transition('ready');
          }.bind(this);
          var onRepublishFailed = function(err) {
            logger.error(`Failed to republish ${this.published.count()} messages on ${this.type} exchange, ${this.name} - ${connection.name}`, err);
          }.bind(this);
          this.republish()
            .then(onRepublished, onRepublishFailed);
        },
        check: function() {
          this.deferUntilTransition('ready');
        },
        destroy: function() {
          this.deferUntilTransition('ready');
        },
        publish: function() {
          this.deferUntilTransition('ready');
        },
        released: function() {
          this.transition('initializing');
        }
      }
    }
  });

  Monologue.mixInto(Fsm);
  fsm = new Fsm();
  connection.addExchange(fsm);
  return fsm;
};

module.exports = Channel;
