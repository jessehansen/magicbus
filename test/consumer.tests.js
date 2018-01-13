const magicbus = require('..')
const Consumer = require('../lib/consumer.js')
const EventEmitter = require('events').EventEmitter

const Logger = require('../lib/logger')

describe('Consumer', () => {
  let mockBroker
  let logs
  let logEvents
  let logger

  let eventName
  let fakeMessage
  let fakePipeline
  let fakePattern

  beforeEach(() => {
    logEvents = new EventEmitter()
    logs = []
    logger = Logger('magicbus.tests', logEvents)
    logEvents.on('log', (data) => {
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

    fakePipeline = { useLogger: () => {} }
    fakePattern = () => Promise.resolve({ queueName: 'my-queue' })

    let registeredConsumer
    mockBroker = {
      registerRoute: jest.fn((/* name, pattern */) => {}),
      consume: jest.fn((routeName, callback/* , options */) => {
        registeredConsumer = callback
      }),
      emulateConsumption: () =>
        new Promise((resolve) => {
          let ops = {
            ack: () => {
              fakeMessage.__resolution = 'ack'
              resolve()
            },
            nack: () => {
              fakeMessage.__resolution = 'nack'
              resolve()
            },
            reject: () => {
              fakeMessage.__resolution = 'reject'
              resolve()
            }
          }

          process.nextTick(() => {
            registeredConsumer(fakeMessage, ops)
          })
        })
    }
  })

  describe('constructor', () => {
    it('should throw an assertion error given no broker', () => {
      let fn = () => {
        Consumer()
      }

      expect(fn).toThrow('broker (object) is required')
    })
    it('should throw an assertion error given no envelope', () => {
      let fn = () => {
        Consumer(mockBroker)
      }

      expect(fn).toThrow('envelope (object) is required')
    })
    it('should throw an assertion error given no serializer', () => {
      let fn = () => {
        Consumer(mockBroker, {})
      }

      expect(fn).toThrow('serializer (object) is required')
    })
    it('should throw an assertion error given no pipeline', () => {
      let fn = () => {
        Consumer(mockBroker, {}, {})
      }

      expect(fn).toThrow('pipeline (object) is required')
    })
    it('should throw an assertion error given no routeName', () => {
      let fn = () => {
        Consumer(mockBroker, {}, {}, fakePipeline)
      }

      expect(fn).toThrow('routeName (string) is required')
    })
    it('should throw an assertion error given no routePattern', () => {
      let fn = () => {
        Consumer(mockBroker, {}, {}, fakePipeline, 'route')
      }

      expect(fn).toThrow('routePattern (func) is required')
    })
    it('should throw an assertion error given no logger', () => {
      let fn = () => {
        Consumer(mockBroker, {}, {}, fakePipeline, 'route', fakePattern)
      }

      expect(fn).toThrow('logger (object) is required')
    })
    it('should throw an assertion error given no events', () => {
      let fn = () => {
        Consumer(mockBroker, {}, {}, fakePipeline, 'route', fakePattern, {})
      }

      expect(fn).toThrow('events (object) is required')
    })
    it('should register a route with the broker', () => {
      Consumer(mockBroker, {}, {}, fakePipeline, 'route', fakePattern, logger, logEvents)
      expect(mockBroker.registerRoute).toHaveBeenCalledWith('route', fakePattern)
    })

    describe('constructor argument checking', () => {
      it('should throw an assertion error given no broker', () => {
        let fn = () => {
          Consumer()
        }

        expect(fn).toThrow('broker (object) is required')
      })
    })
  })

  describe('#startConsuming', () => {
    let consumer

    beforeEach(() => {
      consumer = magicbus.createConsumer(mockBroker, (cfg) => {
        cfg.useLogger(logger)
      })
    })

    describe('acknowledging messages based on handler results', () => {
      it('should ack the message given a synchronous handler that does not throw', () => {
        let handler = function (/* handlerData, messageTypes, message */) {
          // Not throwing an exception here
        }

        consumer.startConsuming(handler)
        return mockBroker.emulateConsumption()
          .then(() => {
            expect(fakeMessage.__resolution).toEqual('ack')
          })
      })

      it('should reject the message given a synchronous handler that throws', () => {
        let handler = function (/* handlerData, messageTypes, message */) {
          throw new Error('Aw, snap!')
        }

        consumer.startConsuming(handler)
        return mockBroker.emulateConsumption()
          .then(() => {
            expect(logs.length).toBeGreaterThan(1)
            expect(logs.some((l) => l.err !== undefined)).toBeTruthy()
            expect(fakeMessage.__resolution).toEqual('reject')
          })
      })

      it('should ack the message after the handler has completed given an asynchronous handler that resolves successfully', () => {
        let handlerCompleted = false
        let handler = (/* handlerData, messageTypes, message */) =>
          new Promise((resolve) => {
            process.nextTick(() => {
              handlerCompleted = true
              resolve()
            })
          })

        consumer.startConsuming(handler)
        return mockBroker.emulateConsumption()
          .then(() => {
            expect(fakeMessage.__resolution).toEqual('ack')
            expect(handlerCompleted).toEqual(true)
          })
      })

      it('should reject the message after the handler has completed given an asynchronous handler that rejects/resolves with an error', () => {
        let handlerCompleted = false
        let handler = (/* handlerData, messageTypes, message */) =>
          new Promise((resolve, reject) => {
            process.nextTick(() => {
              handlerCompleted = true
              reject(new Error('Aw, snap!'))
            })
          })

        consumer.startConsuming(handler)
        return mockBroker.emulateConsumption()
          .then(() => {
            expect(logs.length).toBeGreaterThan(1)
            expect(logs[logs.length - 2].err).toBeTruthy()
            expect(fakeMessage.__resolution).toEqual('reject')
            expect(handlerCompleted).toEqual(true)
          })
      })

      it('should nack if the handler requests it', () => {
        let handlerCalled = false
        let handler = (handlerData, messageTypes, message, actions) => {
          handlerCalled = true
          actions.nack()
          return Promise.resolve()
        }

        consumer.startConsuming(handler)
        return mockBroker.emulateConsumption()
          .then(() => {
            expect(fakeMessage.__resolution).toEqual('nack')
            expect(handlerCalled).toEqual(true)
          })
      })

      describe('using middleware', () => {
        let handlerCompleted
        let handlerPayload

        beforeEach(() => {
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

        it('should call middleware when provided', () => {
          consumer.use(modify)
          consumer.startConsuming(handler)
          return mockBroker.emulateConsumption()
            .then(() => {
              expect(fakeMessage.__resolution).toEqual('ack')
              expect(handlerPayload).toEqual('the payload that is new')
              expect(handlerCompleted).toEqual(true)
            })
        })

        it('should ack when middleware calls ack', () => {
          consumer.use(ack)
          consumer.startConsuming(handler)
          return mockBroker.emulateConsumption()
            .then(() => {
              expect(fakeMessage.__resolution).toEqual('ack')
              expect(handlerCompleted).toEqual(false)
            })
        })

        it('should nack when middleware calls nack', () => {
          consumer.use(nack)
          consumer.startConsuming(handler)
          return mockBroker.emulateConsumption()
            .then(() => {
              expect(fakeMessage.__resolution).toEqual('nack')
              expect(handlerCompleted).toEqual(false)
            })
        })

        it('should reject when middleware calls reject', () => {
          consumer.use(reject)
          consumer.startConsuming(handler)
          return mockBroker.emulateConsumption()
            .then(() => {
              expect(fakeMessage.__resolution).toEqual('reject')
              expect(handlerCompleted).toEqual(false)
            })
        })
      })
    })
  })
})
