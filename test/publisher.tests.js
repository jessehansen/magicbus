const magicbus = require('../lib')
const Publisher = require('../lib/publisher')

const Promise = require('bluebird')
const Logger = require('../lib/logger')

describe('Publisher', function () {
  let mockBroker
  let logger
  let fakePipeline

  beforeEach(function () {
    mockBroker = {
      registerRoute: jest.fn(function (/* name, pattern */) {}),
      publish: jest.fn(function (/* routeName, routingKey, content, options */) {
        return Promise.resolve()
      })
    }
    logger = Logger()
    fakePipeline = { useLogger: function () { } }
  })

  describe('constructor', function () {
    it('should throw an assertion error given no broker', function () {
      let fn = function () {
        Publisher()
      }

      expect(fn).toThrow('broker (object) is required')
    })
    it('should throw an assertion error given no envelope', function () {
      let fn = function () {
        Publisher(mockBroker)
      }

      expect(fn).toThrow('envelope (object) is required')
    })
    it('should throw an assertion error given no pipeline', function () {
      let fn = function () {
        Publisher(mockBroker, {})
      }

      expect(fn).toThrow('pipeline (object) is required')
    })
    it('should throw an assertion error given no routeName', function () {
      let fn = function () {
        Publisher(mockBroker, {}, fakePipeline)
      }

      expect(fn).toThrow('routeName (string) is required')
    })
    it('should throw an assertion error given no routePattern', function () {
      let fn = function () {
        Publisher(mockBroker, {}, fakePipeline, 'route')
      }

      expect(fn).toThrow('routePattern (object) is required')
    })
    it('should throw an assertion error given no logger', function () {
      let fn = function () {
        Publisher(mockBroker, {}, fakePipeline, 'route', {})
      }

      expect(fn).toThrow('logger (object) is required')
    })
    it('should register a route with the broker', function () {
      let pattern = {}

      Publisher(mockBroker, {}, fakePipeline, 'route', pattern, logger)
      expect(mockBroker.registerRoute).toHaveBeenCalledWith('route', pattern)
    })
  })

  describe('publish', function () {
    let publisher

    beforeEach(function () {
      publisher = magicbus.createPublisher(mockBroker)
    })

    it('should register a route with the broker', function () {
      let pattern = {}

      publisher = magicbus.createPublisher(mockBroker, function (cfg) {
        cfg.useRouteName('publish')
        cfg.useRoutePattern(pattern)
      })

      expect(mockBroker.registerRoute).toHaveBeenCalledWith('publish', pattern)
    })

    it('should be rejected with an assertion error given no event name', function () {
      let fn = function () {
        publisher.publish()
      }

      expect(fn).toThrow('eventName (string) is required')
    })

    it('should be fulfilled given the broker.publish calls are fulfilled', function () {
      mockBroker.publish = function () {
        return Promise.resolve()
      }

      return expect(publisher.publish('something-happened')).resolves.toBeUndefined()
    })

    it('should be rejected given the broker.publish call is rejected', function () {
      mockBroker.publish = function () {
        return Promise.reject(new Error('Aw, snap!'))
      }

      return expect(publisher.publish('something-happened')).rejects.toThrow('Aw, snap!')
    })

    it('should be rejected given the middleware rejects the message', function () {
      publisher.use(function (message, actions) {
        actions.error(new Error('Aw, snap!'))
      })

      return expect(publisher.publish('something-happened')).rejects.toThrow('Aw, snap!')
    })

    it('should call middleware with the message', function () {
      let middlewareCalled = false
      publisher.use(function (message, actions) {
        middlewareCalled = true
        actions.next()
      })

      return publisher.publish('something-happened').then(function () {
        expect(middlewareCalled).toEqual(true)
      })
    })

    it('should set persistent to true by default', function () {
      return publisher.publish('something-happened').then(function () {
        expect(mockBroker.publish).toHaveBeenCalledWith('publish', expect.objectContaining({ routingKey: 'something-happened', payload: null, persistent: true }))
      })
    })

    it('should copy properties from the properties property of the message to the publish options', function () {
      return publisher.publish('something-happened').then(function () {
        expect(mockBroker.publish).toHaveBeenCalledWith('publish', expect.objectContaining({ routingKey: 'something-happened', payload: null, type: 'something-happened' }))
      })
    })

    it('should copy properties from the publishOptions property of the options to the publish options', function () {
      let options = {
        publishOptions: {
          correlationId: '123'
        }
      }

      return publisher.publish('something-happened', null, options).then(function () {
        expect(mockBroker.publish).toHaveBeenCalledWith('publish', expect.objectContaining({ routingKey: 'something-happened', payload: null, correlationId: '123' }))
      })
    })

    it('should overwrite publish options set from anywhere else with values from the publishOptions property of the options', function () {
      let options = {
        publishOptions: {
          persistent: false
        }
      }

      return publisher.publish('something-happened', null, options).then(function () {
        expect(mockBroker.publish).toHaveBeenCalledWith('publish', expect.objectContaining({ routingKey: 'something-happened', payload: null, persistent: false }))
      })
    })
  })
})
