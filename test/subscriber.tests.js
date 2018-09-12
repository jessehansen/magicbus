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
  let mockContext

  beforeEach(() => {
    let logEvents = new EventEmitter()
    logs = []
    logger = Logger('magicbus.tests', logEvents)
    logEvents.on('log', (data) => {
      logs.push(data)
    })
    mockConsumer = {
      startConsuming: function (handler) {
        this._handler = handler
      }
    }
    eventDispatcher = eventDispatcherFactory()
    eventDispatcher.on = jest.fn(eventDispatcher.on)
    mockContext = {
      ack: jest.fn(),
      nack: jest.fn(),
      reject: jest.fn(),
      next: jest.fn(),
      error: jest.fn()
    }

    subscriber = Subscriber({
      consumer: mockConsumer,
      eventDispatcher,
      logger,
      events: logEvents
    })
  })

  describe('#on', () => {
    it('should pass through to the event dispatcher', () => {
      let eventName = 'myEvent',
        handler = () => {}

      subscriber.on(eventName, handler)

      expect(eventDispatcher.on).toHaveBeenCalledWith(eventName, handler)
    })
  })

  describe('#startSubscription', () => {
    let messageTypes

    beforeEach(() => {
      messageTypes = ['type1', 'type2']
      mockContext.messageTypes = messageTypes
      mockContext.message = 'payload'
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

      return mockConsumer._handler(mockContext).then(() => {
        expect(handler1).toHaveBeenCalledWith(messageTypes[0], mockContext)
        expect(handler2).toHaveBeenCalledWith(messageTypes[1], mockContext)
      })
    })

    it('should allow nacking the message', () => {
      eventDispatcher.on(messageTypes[0], (type, { nack }) => {
        nack()
      })

      subscriber.startSubscription()
      return mockConsumer._handler(mockContext).then(() => {
        expect(mockContext.nack).toHaveBeenCalled()
      })
    })

    it('should fail given no handler is registered for the message type', () => {
      subscriber.startSubscription()
      return expect(mockConsumer._handler(mockContext)).rejects.toThrow('No handler registered')
    })

    it('should fail given handler fails', () => {
      eventDispatcher.on(messageTypes[0], () => {
        return Promise.reject(new Error('Something happened'))
      })

      subscriber.startSubscription()
      return expect(mockConsumer._handler(mockContext)).rejects.toThrow('Something happened')
        .then(() => {
          expect(logs[logs.length - 1].err).toBeTruthy()
        })
    })
  })
})
