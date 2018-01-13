const magicbus = require('../lib')
const Publisher = require('../lib/publisher')

const Logger = require('../lib/logger')

describe('Publisher', () => {
  let mockBroker
  let logger
  let fakePipeline
  let fakePattern

  beforeEach(() => {
    mockBroker = {
      registerRoute: jest.fn((/* name, pattern */) => {}),
      publish: jest.fn((/* routeName, routingKey, content, options */) => Promise.resolve())
    }
    logger = Logger()
    fakePipeline = { useLogger: () => { } }
    fakePattern = () => Promise.resolve({ exchangeName: 'my-exchange' })
  })

  describe('constructor', () => {
    it('should register a route with the broker', () => {
      Publisher(mockBroker, {}, {}, fakePipeline, 'route', fakePattern, logger)
      expect(mockBroker.registerRoute).toHaveBeenCalledWith('route', fakePattern)
    })
  })

  describe('publish', () => {
    let publisher

    beforeEach(() => {
      publisher = magicbus.createPublisher(mockBroker)
    })

    it('should be rejected with an assertion error given no event name', () => {
      let fn = () => {
        publisher.publish()
      }

      expect(fn).toThrow('eventName must be a string')
    })

    it('should be fulfilled given the broker.publish calls are fulfilled', () => {
      mockBroker.publish = () => Promise.resolve()

      return expect(publisher.publish('something-happened')).resolves.toBeUndefined()
    })

    it('should be rejected given the broker.publish call is rejected', () => {
      mockBroker.publish = () => Promise.reject(new Error('Aw, snap!'))

      return expect(publisher.publish('something-happened')).rejects.toThrow('Aw, snap!')
    })

    it('should be rejected given the middleware rejects the message', () => {
      publisher.use((message, actions) => {
        actions.error(new Error('Aw, snap!'))
      })

      return expect(publisher.publish('something-happened')).rejects.toThrow('Aw, snap!')
    })

    it('should call middleware with the message', () => {
      let middlewareCalled = false
      publisher.use((message, actions) => {
        middlewareCalled = true
        actions.next()
      })

      return publisher.publish('something-happened').then(() => {
        expect(middlewareCalled).toEqual(true)
      })
    })

    it('should set persistent to true by default', () => {
      return publisher.publish('something-happened').then(() => {
        expect(mockBroker.publish).toHaveBeenCalledWith('publish', expect.objectContaining({ routingKey: 'something-happened', payload: null, persistent: true }))
      })
    })

    it('should copy properties from the properties property of the message to the publish options', () => {
      return publisher.publish('something-happened').then(() => {
        expect(mockBroker.publish).toHaveBeenCalledWith('publish', expect.objectContaining({ routingKey: 'something-happened', payload: null, type: 'something-happened' }))
      })
    })

    it('should copy properties from the publishOptions property of the options to the publish options', () => {
      let options = {
        publishOptions: {
          correlationId: '123'
        }
      }

      return publisher.publish('something-happened', null, options).then(() => {
        expect(mockBroker.publish).toHaveBeenCalledWith('publish', expect.objectContaining({ routingKey: 'something-happened', payload: null, correlationId: '123' }))
      })
    })

    it('should overwrite publish options set from anywhere else with values from the publishOptions property of the options', () => {
      let options = {
        publishOptions: {
          persistent: false
        }
      }

      return publisher.publish('something-happened', null, options).then(() => {
        expect(mockBroker.publish).toHaveBeenCalledWith('publish', expect.objectContaining({ routingKey: 'something-happened', payload: null, persistent: false }))
      })
    })
  })
})
