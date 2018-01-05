const magicbus = require('..')
const Consumer = require('../lib/consumer.js')
const EventEmitter = require('events').EventEmitter

const Promise = require('bluebird')
const Logger = require('../lib/logger')

describe('Consumer', function () {
  let mockBroker
  let logs
  let logEvents
  let logger

  let eventName
  let fakeMessage
  let fakePipeline

  beforeEach(function () {
    logEvents = new EventEmitter()
    logs = []
    logger = Logger('magicbus.tests', logEvents)
    logEvents.on('log', function (data) {
      logs.push(data)
    })

    // The fake message needs to be real enough to thread the needle through the
    // envelope, serialization, and dispatch parts of the pipeline
    eventName = 'my-event'
    fakeMessage = {
      properties: {
        type: eventName
      },
      content: Buffer.from(JSON.stringify('the payload'))
    }

    fakePipeline = { useLogger: function () {} }

    mockBroker = {
      registerRoute: jest.fn((/* name, pattern */) => {}),
      consume: function (routeName, callback /* , options */) {
        this._routeName = routeName
        this._consumer = callback
      },
      emulateConsumption: function () {
        let self = this
        return new Promise(function (resolve) {
          let ops = {
            ack: function () {
              fakeMessage.__resolution = 'ack'
              resolve()
            },
            nack: function () {
              fakeMessage.__resolution = 'nack'
              resolve()
            },
            reject: function () {
              fakeMessage.__resolution = 'reject'
              resolve()
            }
          }

          process.nextTick(function () {
            self._consumer(fakeMessage, ops)
          })
        })
      }
    }
  })

  describe('constructor', function () {
    it('should throw an assertion error given no broker', function () {
      let fn = function () {
        Consumer()
      }

      expect(fn).toThrow('broker (object) is required')
    })
    it('should throw an assertion error given no envelope', function () {
      let fn = function () {
        Consumer(mockBroker)
      }

      expect(fn).toThrow('envelope (object) is required')
    })
    it('should throw an assertion error given no pipeline', function () {
      let fn = function () {
        Consumer(mockBroker, {})
      }

      expect(fn).toThrow('pipeline (object) is required')
    })
    it('should throw an assertion error given no routeName', function () {
      let fn = function () {
        Consumer(mockBroker, {}, fakePipeline)
      }

      expect(fn).toThrow('routeName (string) is required')
    })
    it('should throw an assertion error given no routePattern', function () {
      let fn = function () {
        Consumer(mockBroker, {}, fakePipeline, 'route')
      }

      expect(fn).toThrow('routePattern (object) is required')
    })
    it('should throw an assertion error given no logger', function () {
      let fn = function () {
        Consumer(mockBroker, {}, fakePipeline, 'route', {})
      }

      expect(fn).toThrow('logger (object) is required')
    })
    it('should throw an assertion error given no events', function () {
      let fn = function () {
        Consumer(mockBroker, {}, fakePipeline, 'route', {}, {})
      }

      expect(fn).toThrow('events (object) is required')
    })
    it('should register a route with the broker', function () {
      let pattern

      pattern = {}
      Consumer(mockBroker, {}, fakePipeline, 'route', pattern, logger, logEvents)
      expect(mockBroker.registerRoute).toHaveBeenCalledWith('route', pattern)
    })

    describe('constructor argument checking', function () {
      it('should throw an assertion error given no broker', function () {
        let fn = function () {
          Consumer()
        }

        expect(fn).toThrow('broker (object) is required')
      })
    })
  })

  describe('#startConsuming', function () {
    let consumer

    beforeEach(function () {
      consumer = magicbus.createConsumer(mockBroker, function (cfg) {
        cfg.useLogger(logger)
      })
    })

    describe('acknowledging messages based on handler results', function () {
      it('should ack the message given a synchronous handler that does not throw', function () {
        let handler = function (/* handlerData, messageTypes, message */) {
          // Not throwing an exception here
        }

        consumer.startConsuming(handler)
        return mockBroker.emulateConsumption()
          .then(function () {
            expect(fakeMessage.__resolution).toEqual('ack')
          })
      })

      it('should reject the message given a synchronous handler that throws', function () {
        let handler = function (/* handlerData, messageTypes, message */) {
          throw new Error('Aw, snap!')
        }

        consumer.startConsuming(handler)
        return mockBroker.emulateConsumption()
          .then(function () {
            expect(logs.length).toBeGreaterThan(1)
            expect(logs[logs.length - 2].err).toBeTruthy()
            expect(fakeMessage.__resolution).toEqual('reject')
          })
      })

      it('should ack the message after the handler has completed given an asynchronous handler that resolves successfully', function () {
        let handlerCompleted = false
        let handler = function (/* handlerData, messageTypes, message */) {
          return new Promise(function (resolve) {
            process.nextTick(function () {
              handlerCompleted = true
              resolve()
            })
          })
        }

        consumer.startConsuming(handler)
        return mockBroker.emulateConsumption()
          .then(function () {
            expect(fakeMessage.__resolution).toEqual('ack')
            expect(handlerCompleted).toEqual(true)
          })
      })

      it('should reject the message after the handler has completed given an asynchronous handler that rejects/resolves with an error', function () {
        let handlerCompleted = false
        let handler = function (/* handlerData, messageTypes, message */) {
          return new Promise(function (resolve, reject) {
            process.nextTick(function () {
              handlerCompleted = true
              reject(new Error('Aw, snap!'))
            })
          })
        }

        consumer.startConsuming(handler)
        return mockBroker.emulateConsumption()
          .then(function () {
            expect(logs.length).toBeGreaterThan(1)
            expect(logs[logs.length - 2].err).toBeTruthy()
            expect(fakeMessage.__resolution).toEqual('reject')
            expect(handlerCompleted).toEqual(true)
          })
      })

      describe('using middleware', function () {
        let handlerCompleted
        let handlerPayload

        beforeEach(function () {
          handlerCompleted = false
          handlerPayload = null
        })

        function handler (handlerData /*, messageTypes, message */) {
          handlerCompleted = true
          handlerPayload = handlerData
        }

        function ack (message, actions) {
          actions.ack()
        }

        function nack (message, actions) {
          actions.nack()
        }

        function reject (message, actions) {
          actions.reject()
        }

        function modify (message, actions) {
          message.payload += ' that is new'
          actions.next()
        }

        it('should call middleware when provided', function () {
          consumer.use(modify)
          consumer.startConsuming(handler)
          return mockBroker.emulateConsumption()
            .then(function () {
              expect(fakeMessage.__resolution).toEqual('ack')
              expect(handlerPayload).toEqual('the payload that is new')
              expect(handlerCompleted).toEqual(true)
            })
        })

        it('should ack when middleware calls ack', function () {
          consumer.use(ack)
          consumer.startConsuming(handler)
          return mockBroker.emulateConsumption()
            .then(function () {
              expect(fakeMessage.__resolution).toEqual('ack')
              expect(handlerCompleted).toEqual(false)
            })
        })

        it('should nack when middleware calls nack', function () {
          consumer.use(nack)
          consumer.startConsuming(handler)
          return mockBroker.emulateConsumption()
            .then(function () {
              expect(fakeMessage.__resolution).toEqual('nack')
              expect(handlerCompleted).toEqual(false)
            })
        })

        it('should reject when middleware calls reject', function () {
          consumer.use(reject)
          consumer.startConsuming(handler)
          return mockBroker.emulateConsumption()
            .then(function () {
              expect(fakeMessage.__resolution).toEqual('reject')
              expect(handlerCompleted).toEqual(false)
            })
        })
      })
    })
  })
})
