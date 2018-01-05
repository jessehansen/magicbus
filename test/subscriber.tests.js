const Subscriber = require('../lib/subscriber')

const EventDispatcher = require('../lib/event-dispatcher')
const Logger = require('../lib/logger')
const EventEmitter = require('events').EventEmitter

describe('Subscriber', function () {
  let mockReceiver
  let eventDispatcher
  let subscriber
  let logger
  let logs

  beforeEach(function () {
    let logEvents = new EventEmitter()
    logs = []
    logger = Logger('magicbus.tests', logEvents)
    logEvents.on('log', function (data) {
      logs.push(data)
    })
    mockReceiver = {
      use: function (/* middleware */) {},
      startConsuming: function (handler) {
        this._handler = handler
      }
    }
    eventDispatcher = new EventDispatcher()

    subscriber = Subscriber(mockReceiver, eventDispatcher, logger, logEvents)
  })

  describe('#on', function () {
    it('should pass through to the event dispatcher', function () {
      let eventName = 'myEvent',
        handler = function () {}
      eventDispatcher.on = jest.fn()

      subscriber.on(eventName, handler)

      expect(eventDispatcher.on).toHaveBeenCalledWith(eventName, handler)
    })
  })

  describe('#use', function () {
    it('should pass through to the reciever', function () {
      let middleware = function () {}
      mockReceiver.use = jest.fn()

      subscriber.use(middleware)

      expect(mockReceiver.use).toHaveBeenCalledWith(middleware)
    })
  })

  describe('#startSubscription', function () {
    let payload, messageTypes, msg

    beforeEach(function () {
      payload = 'payload'
      messageTypes = ['type1', 'type2']
      msg = {
        payload: payload,
        properties: {}
      }
    })

    it('should start the receiver', function () {
      mockReceiver.startConsuming = jest.fn()

      subscriber.startSubscription()

      expect(mockReceiver.startConsuming).toHaveBeenCalled()
    })

    it('should pass consumed events to the dispatcher', function () {
      let handler1 = jest.fn()
      let handler2 = jest.fn()

      eventDispatcher.on(messageTypes[0], handler1)
      eventDispatcher.on(messageTypes[1], handler2)

      subscriber.startSubscription()

      return mockReceiver._handler(payload, messageTypes, msg).then(function () {
        expect(handler1).toHaveBeenCalledWith(messageTypes[0], payload, msg)
        expect(handler2).toHaveBeenCalledWith(messageTypes[1], payload, msg)
      })
    })

    it('should fail given synchronous handler fails', function () {
      eventDispatcher.on(messageTypes[0], function () {
        throw new Error('Something happened')
      })

      subscriber.startSubscription()
      return expect(mockReceiver._handler(payload, messageTypes, msg)).rejects.toThrow('Something happened')
        .then(function () {
          expect(logs[logs.length - 1].err).toBeTruthy()
        })
    })

    it('should fail given no handler is registered for the message type', function () {
      subscriber.startSubscription()
      return expect(mockReceiver._handler(payload, messageTypes, msg)).rejects.toThrow('No handler registered')
    })

    it('should fail given async handler fails', function () {
      eventDispatcher.on(messageTypes[0], function () {
        return Promise.reject(new Error('Something happened'))
      })

      subscriber.startSubscription()
      return expect(mockReceiver._handler(payload, messageTypes, msg)).rejects.toThrow('Something happened')
        .then(function () {
          expect(logs[logs.length - 1].err).toBeTruthy()
        })
    })
  })
})
