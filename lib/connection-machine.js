// initial version from https://github.com/LeanKit-Labs/wascally
const Monologue = require('monologue.js')
const DeferredPromise = require('./deferred-promise')
const machina = require('machina')

const createConnectionMachine = (options, logger, connectionFactory, channelFactory) => {
  let ConnectionFactory = connectionFactory || require('./amqp/connection')
  let ChannelFactory = channelFactory || require('./amqp/channel')

  let connection
  let queues = []
  let exchanges = []
  let cLog = logger.withNamespace('connection')

  const ConnectionMachine = machina.Fsm.extend({
    name: options.name || 'default',
    initialState: 'initializing',
    reconnected: false,

    doClose: function () {
      connection.close().then(() => {
        this.transition('closed')
      })
    },

    addQueue: function (queue) {
      queues.push(queue)
    },

    addExchange: function (exchange) {
      exchanges.push(exchange)
    },

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

    createChannel: function (confirm) {
      this.connect()
      return ChannelFactory(connection, confirm, logger)
    },

    connect: function () {
      let deferred = DeferredPromise()
      this.handle('connect', deferred)
      return deferred.promise
    },

    lastError: function () {
      return connection.lastError
    },

    replay: function (ev) {
      return (x) => {
        this.emit(ev, x)
        this.handle(ev, x)
      }
    },

    states: {
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
