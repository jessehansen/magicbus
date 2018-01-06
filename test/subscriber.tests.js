const Subscriber = require('../lib/subscriber')

const eventDispatcherFactory = require('../lib/event-dispatcher')
const Logger = require('../lib/logger')
const EventEmitter = require('events').EventEmitter

describe('Subscriber', () => {
  let mockConsumer
  let eventDispatcher
  let subscriber
  let logger
  let logs

  beforeEach(() => {
    let logEvents = new EventEmitter()
    logs = []
    logger = Logger('magicbus.tests', logEvents)
    logEvents.on('log', (data) => {
      logs.push(data)
    })
    mockConsumer = {
      use: function (/* middleware */) {},
      startConsuming: function (handler) {
        this._handler = handler
      }
    }
    eventDispatcher = eventDispatcherFactory()

    subscriber = Subscriber(mockConsumer, eventDispatcher, logger, logEvents)
  })

  describe('#on', () => {
    it('should pass through to the event dispatcher', () => {
      let eventName = 'myEvent',
        handler = () => {}
      eventDispatcher.on = jest.fn()

      subscriber.on(eventName, handler)

      expect(eventDispatcher.on).toHaveBeenCalledWith(eventName, handler)
    })
  })

  describe('#use', () => {
    it('should pass through to the reciever', () => {
      let middleware = () => {}
      mockConsumer.use = jest.fn()

      subscriber.use(middleware)

      expect(mockConsumer.use).toHaveBeenCalledWith(middleware)
    })
  })

  describe('#startSubscription', () => {
    let payload, messageTypes, msg

    beforeEach(() => {
      payload = 'payload'
      messageTypes = ['type1', 'type2']
      msg = {
        payload: payload,
        properties: {}
      }
    })

    it('should start the receiver', () => {
      mockConsumer.startConsuming = jest.fn()

      subscriber.startSubscription()

      expect(mockConsumer.startConsuming).toHaveBeenCalled()
    })

    it('should pass consumed events to the dispatcher', () => {
      let handler1 = jest.fn()
      let handler2 = jest.fn()

      eventDispatcher.on(messageTypes[0], handler1)
      eventDispatcher.on(messageTypes[1], handler2)

      subscriber.startSubscription()

      return mockConsumer._handler(payload, messageTypes, msg).then(() => {
        expect(handler1).toHaveBeenCalledWith(messageTypes[0], payload, msg)
        expect(handler2).toHaveBeenCalledWith(messageTypes[1], payload, msg)
      })
    })

    it('should fail given synchronous handler fails', () => {
      eventDispatcher.on(messageTypes[0], () => {
        throw new Error('Something happened')
      })

      subscriber.startSubscription()
      return expect(mockConsumer._handler(payload, messageTypes, msg)).rejects.toThrow('Something happened')
        .then(() => {
          expect(logs[logs.length - 1].err).toBeTruthy()
        })
    })

    it('should fail given no handler is registered for the message type', () => {
      subscriber.startSubscription()
      return expect(mockConsumer._handler(payload, messageTypes, msg)).rejects.toThrow('No handler registered')
    })

    it('should fail given async handler fails', () => {
      eventDispatcher.on(messageTypes[0], () => {
        return Promise.reject(new Error('Something happened'))
      })

      subscriber.startSubscription()
      return expect(mockConsumer._handler(payload, messageTypes, msg)).rejects.toThrow('Something happened')
        .then(() => {
          expect(logs[logs.length - 1].err).toBeTruthy()
        })
    })
  })
})
