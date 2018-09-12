const magicbus = require('..')
const Pipe = require('magicpipes')
const { EventEmitter } = require('events')

const Logger = require('../lib/logger')

const exchange = 'my-exchange'
const content = 'content'
const routingKey = 'my-key'

describe('Publisher', () => {
  let mockBroker
  let logger
  let publisher
  let mockFilter

  beforeEach(() => {
    mockBroker = {
      publish: jest.fn(() => Promise.resolve())
    }
    logger = Logger('tests', new EventEmitter())
    mockFilter = jest.fn((ctx, next) =>
      next(Object.assign(ctx, { exchange, content, routingKey })))
    publisher = magicbus.createPublisher(mockBroker, (cfg) =>
      cfg.useLogger(logger)
        .overrideFilters({ input: [mockFilter], output: [] }))
  })

  describe('publish', () => {
    const event = 'something-happened'
    const data = { some: 'data' }

    it('should be rejected with an assertion error given no event name', () => {
      let fn = () => {
        publisher.publish()
      }

      expect(fn).toThrow('eventName must be a string')
    })

    it('should be fulfilled given the broker.publish calls are fulfilled', () => {
      return expect(publisher.publish(event)).resolves.toBeUndefined()
    })

    it('should be rejected given the broker.publish call is rejected', () => {
      mockBroker.publish = () => Promise.reject(new Error('Aw, snap!'))

      return expect(publisher.publish(event)).rejects.toEqual(new Error('Aw, snap!'))
    })

    it('should call broker publish with the correct options', async () => {
      await publisher.publish(event)
      expect(mockBroker.publish).toHaveBeenCalledWith({ exchange, routingKey, content, options: {} })
    })

    it('should call middleware with the correct context', async () => {
      await publisher.publish(event, data)
      expect(mockFilter).toHaveBeenCalledWith(
        expect.objectContaining({ message: data, kind: event }), expect.any(Function))
    })

    it('should allow passing options', async () => {
      await publisher.publish(event, data, { some: 'options' })
      expect(mockFilter).toHaveBeenCalledWith(
        expect.objectContaining({ message: data, kind: event, publishOptions: { some: 'options' } }), expect.any(Function))
    })

    it('should be rejected given the input pipe rejects the message', async () => {
      publisher = magicbus.createPublisher(mockBroker, (cfg) =>
        cfg.useLogger(logger)
          .overrideFilters({ input: [() => Promise.reject('Aw, snap!')], output: [] }))

      await expect(publisher.publish(event)).rejects.toEqual('Aw, snap!')
      expect(mockBroker.publish).not.toHaveBeenCalled()
    })

    it('should be rejected given the output pipe rejects the message', async () => {
      publisher = magicbus.createPublisher(mockBroker, (cfg) =>
        cfg.useLogger(logger)
          .overrideFilters({ input: [], output: [() => Promise.reject('Aw, snap!')] }))

      await expect(publisher.publish(event)).rejects.toEqual('Aw, snap!')
      expect(mockBroker.publish).not.toHaveBeenCalled()
    })

    it('should call filters in the correct order', async () => {
      let middlewareCalls = []
      publisher = magicbus.createPublisher(mockBroker, (cfg) =>
        cfg.useLogger(logger)
          .overrideFilters({
            input: [(ctx, next) => {
              middlewareCalls.push('input')
              return next(ctx)
            }],
            output: [(ctx, next) => {
              middlewareCalls.push('output')
              return next(ctx)
            }]
          }))

      await publisher.publish(event, data, { pipe: Pipe((ctx, next) => {
        middlewareCalls.push('per-publish')
        return next(ctx)
      }) })
      expect(middlewareCalls).toEqual(['input', 'per-publish', 'output'])
    })
  })

  describe('send', () => {
    const type = 'something-happened'
    const message = { some: 'command' }

    it('should be rejected with an assertion error given no command', () => {
      let fn = () => {
        publisher.send()
      }

      expect(fn).toThrow('message must be provided')
    })

    it('should be rejected with an assertion error given non string type', () => {
      let fn = () => {
        publisher.send(message, { some: 'data' })
      }

      expect(fn).toThrow('messageType must be a string')
    })

    it('should be fulfilled given the broker.publish calls are fulfilled', () => {
      return expect(publisher.send(message)).resolves.toBeUndefined()
    })

    it('should be rejected given the broker.publish call is rejected', () => {
      mockBroker.publish = () => Promise.reject(new Error('Aw, snap!'))

      return expect(publisher.send(message)).rejects.toEqual(new Error('Aw, snap!'))
    })

    it('should call broker publish with the correct options', async () => {
      await publisher.send(message)
      expect(mockBroker.publish).toHaveBeenCalledWith({ exchange, routingKey, content, options: {} })
    })

    it('should call middleware with the correct context', async () => {
      await publisher.send(message, type)
      expect(mockFilter).toHaveBeenCalledWith(expect.objectContaining({ message, kind: type }), expect.any(Function))
    })

    it('should call allow passing options', async () => {
      await publisher.send(message, type, { some: 'options' })
      expect(mockFilter).toHaveBeenCalledWith(expect.objectContaining({ message, kind: type, publishOptions: { some: 'options' } }), expect.any(Function))
    })

    it('should be rejected given the input pipe rejects the message', async () => {
      publisher = magicbus.createPublisher(mockBroker, (cfg) =>
        cfg.useLogger(logger)
          .overrideFilters({ input: [() => Promise.reject('Aw, snap!')], output: [] }))

      await expect(publisher.send(message)).rejects.toEqual('Aw, snap!')
      expect(mockBroker.publish).not.toHaveBeenCalled()
    })

    it('should be rejected given the output pipe rejects the message', async () => {
      publisher = magicbus.createPublisher(mockBroker, (cfg) =>
        cfg.useLogger(logger)
          .overrideFilters({ input: [], output: [() => Promise.reject('Aw, snap!')] }))

      await expect(publisher.send(message)).rejects.toEqual('Aw, snap!')
      expect(mockBroker.publish).not.toHaveBeenCalled()
    })

    it('should call filters in the correct order', async () => {
      let middlewareCalls = []
      publisher = magicbus.createPublisher(mockBroker, (cfg) =>
        cfg.useLogger(logger)
          .overrideFilters({
            input: [(ctx, next) => {
              middlewareCalls.push('input')
              return next(ctx)
            }],
            output: [(ctx, next) => {
              middlewareCalls.push('output')
              return next(ctx)
            }]
          }))

      await publisher.send(message, type, { pipe: Pipe((ctx, next) => {
        middlewareCalls.push('per-send')
        return next(ctx)
      }) })
      expect(middlewareCalls).toEqual(['input', 'per-send', 'output'])
    })
  })
})
