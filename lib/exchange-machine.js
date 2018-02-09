// initial version from https://github.com/LeanKit-Labs/wascally
const DeferredPromise = require('./deferred-promise')
const machina = require('machina')
const Monologue = require('monologue.js')
const PublishLog = require('./publish-log')
const Exchange = require('./amqp/exchange')

const ExchangeMachine = (options, connection, topology, logger) => {
  /**
   * State Machine representing a rabbitmq exchange, with states around connection and definition
   * @class ExchangeMachine
   * @private
   */
  const ExchangeMachine = machina.Fsm.extend({
    name: options.name,
    type: options.type,
    channel: undefined,
    handlers: [],
    deferred: [],
    published: PublishLog(),

    /**
     * Defines exchange
     *
     * @private
     * @memberOf ExchangeMachine.prototype
     */
    define: function (stateOnDefined) {
      const onDefinitionError = (err) => {
        this.failedWith = err
        this.transition('failed')
      }
      const onDefined = () => {
        this.transition(stateOnDefined)
      }
      this.channel.define()
        .then(onDefined, onDefinitionError)
    },

    /**
     * Listens for events around bindings and reconnecting
     *
     * @private
     * @memberOf ExchangeMachine.prototype
     */
    listenForConnectionEvents: function () {
      this.handlers.push(topology.on('bindings-completed', () => {
        this.handle('bindings-completed')
      }))
      this.handlers.push(connection.on('reconnected', () => {
        this.transition('reconnecting')
      }))
      this.handlers.push(this.on('failed', (err) => {
        this.deferred.forEach((x) => x(err))
        this.deferred = []
      }))
    },

    /**
     * Removes DeferredPromise from the tracked list
     *
     * @private
     * @memberOf ExchangeMachine.prototype
     */
    removeDeferred: function (reject) {
      let index = this.deferred.indexOf(reject)
      if (index >= 0) {
        this.deferred.splice(index, 1)
      }
    },

    /**
     * Returns a promise that is fulfilled or rejected when the channel is defined and ready or failed
     *
     * @private
     * @memberOf ExchangeMachine.prototype
     * @returns {Promise}
     */
    check: function () {
      let deferred = DeferredPromise()
      this.handle('check', deferred)
      return deferred.promise
    },

    /**
     * Destroy the exchange
     *
     * @public
     * @memberOf ExchangeMachine.prototype
     * @returns {Promise} a promise that is fulfilled when destruction is complete
     */
    destroy: function () {
      let deferred = DeferredPromise()
      logger.debug(`Destroy called on exchange ${this.name} - ${connection.name} exchange(${this.published.count()} messages pending)`)
      this.handle('destroy', deferred)
      return deferred.promise
    },

    /**
     * Publish a message to the exchange
     *
     * @public
     * @memberOf ExchangeMachine.prototype
     * @param {Object} message - the message to publish, passed to Exchange.publish
     * @param {Number} message.timeout - the time to wait before abandoning the publish
     * @returns {Promise} a promise that is fulfilled when publication is complete
     */
    publish: function ({ routingKey, content, options: messageOptions = {} }) {
      let publishTimeout = messageOptions.timeout || options.publishTimeout || 0
      logger.silly(`Publish called in state ${this.state}`)
      return new Promise((resolve, reject) => {
        let timeout
        let timedOut
        if (publishTimeout > 0) {
          timeout = setTimeout(() => {
            timedOut = true
            reject(new Error('Publish took longer than configured timeout'))
            this.removeDeferred(reject)
          }, publishTimeout)
        }
        const onPublished = () => {
          resolve()
          this.removeDeferred(reject)
        }
        const onRejected = (err) => {
          reject(err)
          this.removeDeferred(reject)
        }
        let op = () => {
          if (timeout) {
            clearTimeout(timeout)
            timeout = null
          }
          if (!timedOut) {
            return this.channel.publish({ routingKey, content, options: messageOptions })
              .then(onPublished, onRejected)
          }
          return Promise.resolve()
        }
        this.deferred.push(reject)
        this.handle('publish', op)
      })
    },

    /**
     * Republish any undelivered messages (called upon connection)
     *
     * @public
     * @memberOf ExchangeMachine.prototype
     * @returns {Promise} a promise that is fulfilled when publication is complete
     */
    republish: function () {
      let undelivered = this.published.reset()
      if (undelivered.length > 0) {
        return Promise.all(undelivered.map((message) => this.channel.publish(message)))
      }
      return Promise.resolve(true)
    },

    initialState: 'setup',

    /**
     * States and transitions
     *
     * @public
     * @memberOf ExchangeMachine.prototype
     */
    states: {
      /**
       * Initial state - sets up event handling and transitions to initializing
       * @memberOf ExchangeMachine.prototype.states
       */
      setup: {
        _onEnter: function () {
          this.listenForConnectionEvents()
          this.transition('initializing')
        }
      },
      /**
       * Exchange has been destroyed
       * @memberOf ExchangeMachine.prototype.states
       */
      destroyed: {
        _onEnter: function () {
          if (this.published.count() > 0) {
            logger.warn(`${this.type} exchange ${this.name} - ${connection.name} was destroyed exchangewith ${this.published.count()} messages unconfirmed`)
          }
          this.handlers.forEach((handle) => {
            handle.unsubscribe()
          })
          this.channel.destroy()
            .then(() => {
              this.emit('destroyed')
              this.channel = undefined
            })
        },
        'bindings-completed': function () {
          this.deferUntilTransition('reconnected')
        },
        check: function () {
          this.deferUntilTransition('ready')
        },
        destroy: function (deferred) {
          deferred.resolve()
          this.emit('destroyed')
        },
        publish: function () {
          this.transition('reconnecting')
          this.deferUntilTransition('ready')
        }
      },
      /**
       * Sets up Exchange instance and transitions to ready
       * @memberOf ExchangeMachine.prototype.states
       */
      initializing: {
        _onEnter: function () {
          this.channel = Exchange(options, connection, this.published, logger)
          this.channel.once('released', () => {
            this.handle('released')
          })
          this.define('ready')
        },
        check: function () {
          this.deferUntilTransition('ready')
        },
        destroy: function () {
          this.deferUntilTransition('ready')
        },
        released: function () {
          this.transition('initializing')
        },
        publish: function () {
          this.deferUntilTransition('ready')
        }
      },
      /**
       * Exchange definition or connection has failed
       * @memberOf ExchangeMachine.prototype.states
       */
      failed: {
        _onEnter: function () {
          this.emit('failed', this.failedWith)
          this.channel = undefined
        },
        check: function (deferred) {
          deferred.reject(this.failedWith)
          this.emit('failed', this.failedWith)
        },
        destroy: function () {
          this.deferUntilTransition('ready')
        },
        publish: function () {
          this.emit('failed', this.failedWith)
        }
      },
      /**
       * Exchange is ready for publishing
       * @memberOf ExchangeMachine.prototype.states
       */
      ready: {
        _onEnter: function () {
          this.emit('defined')
        },
        check: function (deferred) {
          deferred.resolve()
          this.emit('defined')
        },
        destroy: function () {
          this.deferUntilTransition('destroyed')
          this.transition('destroyed')
        },
        released: function () {
          this.transition('initializing')
        },
        publish: function (op) {
          op()
        }
      },
      /**
       * Reconnecting
       * @memberOf ExchangeMachine.prototype.states
       */
      reconnecting: {
        _onEnter: function () {
          this.channel = Exchange(options, connection, this.published, logger)
          this.channel.once('released', () => {
            this.handle('released')
          })
          this.define('reconnected')
        },
        'bindings-completed': function () {
          this.deferUntilTransition('reconnected')
        },
        check: function () {
          this.deferUntilTransition('ready')
        },
        destroy: function () {
          this.deferUntilTransition('ready')
        },
        publish: function () {
          this.deferUntilTransition('ready')
        }
      },
      /**
       * Reconnection complete - transitions to ready after bindings are complete and messages are republished
       * @memberOf ExchangeMachine.prototype.states
       */
      reconnected: {
        _onEnter: function () {
          this.emit('defined')
        },
        'bindings-completed': function () {
          const onRepublished = () => {
            this.transition('ready')
          }
          const onRepublishFailed = (err) => {
            logger.error(`Failed to republish ${this.published.count()} messages on ${this.type} exchange, exchange${this.name} - ${connection.name}`, err)
            this.transition('ready') // This means we may potentially lose messages, but we are erring on the side of uptime rather than leaving an invalid state
          }
          this.republish()
            .then(onRepublished, onRepublishFailed)
        },
        check: function () {
          this.deferUntilTransition('ready')
        },
        destroy: function () {
          this.deferUntilTransition('ready')
        },
        publish: function () {
          this.deferUntilTransition('ready')
        },
        released: function () {
          this.transition('initializing')
        }
      }
    }
  })

  Monologue.mixInto(ExchangeMachine)
  let exchangeMachine = new ExchangeMachine()
  connection.addExchange(exchangeMachine)
  exchangeMachine.on('transition', (data) => {
    logger.debug(`Machine exchange-${options.name}: ${data.fromState} -> ${data.toState}`)
  })
  return exchangeMachine
}

module.exports = ExchangeMachine
