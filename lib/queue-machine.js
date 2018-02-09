// initial version from https://github.com/LeanKit-Labs/wascally
const DeferredPromise = require('./deferred-promise')
const machina = require('machina')
const Monologue = require('monologue.js')
const QueueFactory = require('./amqp/queue')

const QueueMachine = (options, connection, topology, logger) => {
  let log = logger.withNamespace('queue-machine')

  const QueueMachine = machina.Fsm.extend({
    name: options.name,
    channel: undefined,
    responseSubscriptions: {},
    signalSubscription: undefined,
    handlers: [],
    subscriptions: [],

    define: function () {
      return this.channel.define()
    },

    check: function () {
      let deferred = DeferredPromise()
      this.handle('check', deferred)
      return deferred.promise
    },

    destroy: function () {
      return new Promise((resolve) => {
        log.debug(`Destroy called on queue ${this.name} - ${connection.name} exchange(${this.channel.getMessageCount()} messages pending)`)
        this.on('destroyed', () => {
          this.subscriptions = []
          resolve()
        }).once()
        this.handle('destroy')
      })
    },

    subscribe: function (callback, options) {
      return new Promise((resolve, reject) => {
        let op = () => this.channel.subscribe(callback, options)
          .then(resolve, reject)
        this.on('failed', (err) => reject(err)).once()
        this.handle('subscribe', op)
      })
    },

    purge: function () {
      let deferred = DeferredPromise()
      this.handle('purge', deferred)
      return deferred.promise
    },

    resubscribe: function () {
      if (this.subscriptions.length > 0) {
        return Promise.all(this.subscriptions.map((op) => op())).then(() => {
          log.info(`Restarted ${this.subscriptions.length} subscriptions`)
        })
      }
      return Promise.resolve()
    },

    initialState: 'initializing',

    states: {
      destroying: {
        _onEnter: function () {
          this.handlers.forEach((handle) => {
            handle.unsubscribe()
          })
          this.handlers = []
          this.channel.destroy()
            .then(() => {
              if (this.channel.getMessageCount() > 0) {
                log.warn(`!!! Queue ${options.name} - ${connection.name} was destroyed exchangewith ${this.channel.getMessageCount()} pending messages !!!`)
              } else {
                log.info(`Destroyed queue ${options.name} - ${connection.name}`)
              }
              this.transition('destroyed')
              this.channel = undefined
            })
        },
        destroy: function () {
          this.deferUntilTransition('destroyed')
        },
        check: function () {
          this.deferUntilTransition('destroyed')
        },
        purge: function () {
          this.deferUntilTransition('destroyed')
        }
      },
      destroyed: {
        _onEnter: function () {
          this.emit('destroyed')
        },
        destroy: function () {
          this.emit('destroyed')
        },
        check: function () {
          this.deferUntilTransition('ready')
          this.transition('initializing')
        },
        purge: function () {
          this.deferUntilTransition('ready')
          this.transition('initializing')
        }
      },
      failed: {
        _onEnter: function () {
          this.emit('failed', this.failedWith)
          this.channel = undefined
        },
        check: function (deferred) {
          if (deferred) {
            deferred.reject(this.failedWith)
          }
        },
        destroy: function () {
          this.deferUntilTransition('ready')
        },
        subscribe: function () {
          this.emit('failed', this.failedWith)
        },
        purge: function (deferred) {
          if (deferred) {
            deferred.reject(this.failedWith)
          }
        }
      },
      initializing: {
        _onEnter: function () {
          this.channel = QueueFactory(options, connection, logger)
          this.channel.once('released', () => {
            log.debug(`Queue ${options.name} - ${connection.name} channel released`)
            this.handle('released')
          })
          this.define()
            .then(() => this.resubscribe())
            .then(() => {
              this.transition('ready')
            })
            .catch((err) => {
              log.error(`Failed to define or resubscribe to queue ${this.name} - ${connection.name}`, err)
              this.transition('failed')
            })
        },
        check: function () {
          this.deferUntilTransition('ready')
        },
        destroy: function () {
          this.deferUntilTransition('ready')
        },
        released: function () {
          this.channel.destroy(true)
          this.transition('initializing')
        },
        subscribe: function () {
          this.deferUntilTransition('ready')
        },
        purge: function () {
          this.deferUntilTransition('ready')
        }
      },
      ready: {
        _onEnter: function () {
          this.emit('defined')
        },
        check: function (deferred) {
          deferred.resolve()
        },
        destroy: function () {
          this.transition('destroying')
        },
        released: function () {
          this.channel.destroy(true)
          this.transition('initializing')
        },
        subscribe: function (op) {
          op()
            .then(() => {
              log.debug(`Subscription to (${options.noAck ? 'untracked' : 'tracked'}) queue ${options.name} - ${connection.name} with consumer tag "${this.channel.tag()}"`)
              this.subscriptions.push(op)
            })
        },
        purge: function (deferred) {
          this.channel.purge().then(deferred.resolve)
        }
      }
    }
  })

  Monologue.mixInto(QueueMachine)
  let queueMachine = new QueueMachine()
  connection.addQueue(queueMachine)
  queueMachine.on('transition', (data) => {
    log.debug(`Machine queue-${options.name}: ${data.fromState} -> ${data.toState}`)
  })
  return queueMachine
}

module.exports = QueueMachine
