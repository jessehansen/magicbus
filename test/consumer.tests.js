
let magicbus = require('..')
let Consumer = require('../lib/consumer.js')
let EventEmitter = require('events').EventEmitter

let Promise = require('bluebird')
let Logger = require('../lib/logger')

let chai = require('chai')
let expect = chai.expect

let sinon = require('sinon')
let sinonChai = require('sinon-chai')
chai.use(sinonChai)

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
      registerRoute: function (/* name, pattern */) {},
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

      expect(fn).to.throw('broker (object) is required')
    })
    it('should throw an assertion error given no envelope', function () {
      let fn = function () {
        Consumer(mockBroker)
      }

      expect(fn).to.throw('envelope (object) is required')
    })
    it('should throw an assertion error given no pipeline', function () {
      let fn = function () {
        Consumer(mockBroker, {})
      }

      expect(fn).to.throw('pipeline (object) is required')
    })
    it('should throw an assertion error given no routeName', function () {
      let fn = function () {
        Consumer(mockBroker, {}, fakePipeline)
      }

      expect(fn).to.throw('routeName (string) is required')
    })
    it('should throw an assertion error given no routePattern', function () {
      let fn = function () {
        Consumer(mockBroker, {}, fakePipeline, 'route')
      }

      expect(fn).to.throw('routePattern (object) is required')
    })
    it('should throw an assertion error given no logger', function () {
      let fn = function () {
        Consumer(mockBroker, {}, fakePipeline, 'route', {})
      }

      expect(fn).to.throw('logger (object) is required')
    })
    it('should throw an assertion error given no events', function () {
      let fn = function () {
        Consumer(mockBroker, {}, fakePipeline, 'route', {}, {})
      }

      expect(fn).to.throw('events (object) is required')
    })
    it('should register a route with the broker', function () {
      let pattern
      sinon.spy(mockBroker, 'registerRoute')

      pattern = {}
      Consumer(mockBroker, {}, fakePipeline, 'route', pattern, logger, logEvents)
      expect(mockBroker.registerRoute).to.have.been.calledWith('route', pattern)
    })

    describe('constructor argument checking', function () {
      it('should throw an assertion error given no broker', function () {
        let fn = function () {
          Consumer()
        }

        expect(fn).to.throw('broker (object) is required')
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
            expect(fakeMessage.__resolution).to.equal('ack')
          })
      })

      it('should reject the message given a synchronous handler that throws', function () {
        let handler = function (/* handlerData, messageTypes, message */) {
          throw new Error('Aw, snap!')
        }

        consumer.startConsuming(handler)
        return mockBroker.emulateConsumption()
          .then(function () {
            expect(logs.length).to.be.greaterThan(1)
            expect(logs[logs.length - 2].err).to.be.ok
            expect(fakeMessage.__resolution).to.equal('reject')
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
            expect(fakeMessage.__resolution).to.equal('ack')
            expect(handlerCompleted).to.equal(true)
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
            expect(logs.length).to.be.greaterThan(1)
            expect(logs[logs.length - 2].err).to.be.ok
            expect(fakeMessage.__resolution).to.equal('reject')
            expect(handlerCompleted).to.equal(true)
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
              expect(fakeMessage.__resolution).to.equal('ack')
              expect(handlerPayload).to.equal('the payload that is new')
              expect(handlerCompleted).to.equal(true)
            })
        })

        it('should ack when middleware calls ack', function () {
          consumer.use(ack)
          consumer.startConsuming(handler)
          return mockBroker.emulateConsumption()
            .then(function () {
              expect(fakeMessage.__resolution).to.equal('ack')
              expect(handlerCompleted).to.equal(false)
            })
        })

        it('should nack when middleware calls nack', function () {
          consumer.use(nack)
          consumer.startConsuming(handler)
          return mockBroker.emulateConsumption()
            .then(function () {
              expect(fakeMessage.__resolution).to.equal('nack')
              expect(handlerCompleted).to.equal(false)
            })
        })

        it('should reject when middleware calls reject', function () {
          consumer.use(reject)
          consumer.startConsuming(handler)
          return mockBroker.emulateConsumption()
            .then(function () {
              expect(fakeMessage.__resolution).to.equal('reject')
              expect(handlerCompleted).to.equal(false)
            })
        })
      })
    })
  })
})
