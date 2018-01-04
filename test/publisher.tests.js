
let magicbus = require('../lib')
let Publisher = require('../lib/publisher')

let Promise = require('bluebird')
let Logger = require('../lib/logger')

let chai = require('chai')
let expect = chai.expect

let sinon = require('sinon')
let sinonChai = require('sinon-chai')
chai.use(sinonChai)

chai.use(require('chai-as-promised'))

describe('Publisher', function () {
  let mockBroker
  let logger
  let fakePipeline

  beforeEach(function () {
    mockBroker = {
      registerRoute: function (/* name, pattern */) {},
      publish: function (/* routeName, routingKey, content, options */) {
        return Promise.resolve()
      }
    }
    logger = Logger()
    fakePipeline = { useLogger: function () { } }
  })

  describe('constructor', function () {
    it('should throw an assertion error given no broker', function () {
      let fn = function () {
        Publisher()
      }

      expect(fn).to.throw('broker (object) is required')
    })
    it('should throw an assertion error given no envelope', function () {
      let fn = function () {
        Publisher(mockBroker)
      }

      expect(fn).to.throw('envelope (object) is required')
    })
    it('should throw an assertion error given no pipeline', function () {
      let fn = function () {
        Publisher(mockBroker, {})
      }

      expect(fn).to.throw('pipeline (object) is required')
    })
    it('should throw an assertion error given no routeName', function () {
      let fn = function () {
        Publisher(mockBroker, {}, fakePipeline)
      }

      expect(fn).to.throw('routeName (string) is required')
    })
    it('should throw an assertion error given no routePattern', function () {
      let fn = function () {
        Publisher(mockBroker, {}, fakePipeline, 'route')
      }

      expect(fn).to.throw('routePattern (object) is required')
    })
    it('should throw an assertion error given no logger', function () {
      let fn = function () {
        Publisher(mockBroker, {}, fakePipeline, 'route', {})
      }

      expect(fn).to.throw('logger (object) is required')
    })
    it('should register a route with the broker', function () {
      let pattern = {}
      sinon.spy(mockBroker, 'registerRoute')

      Publisher(mockBroker, {}, fakePipeline, 'route', pattern, logger)
      expect(mockBroker.registerRoute).to.have.been.calledWith('route', pattern)
    })
  })

  describe('publish', function () {
    let publisher

    beforeEach(function () {
      publisher = magicbus.createPublisher(mockBroker)
    })

    it('should register a route with the broker', function () {
      let pattern = {}
      sinon.spy(mockBroker, 'registerRoute')

      publisher = magicbus.createPublisher(mockBroker, function (cfg) {
        cfg.useRouteName('publish')
        cfg.useRoutePattern(pattern)
      })

      expect(mockBroker.registerRoute).to.have.been.calledWith('publish', pattern)
    })

    it('should be rejected with an assertion error given no event name', function () {
      let fn = function () {
        publisher.publish()
      }

      expect(fn).to.throw('eventName (string) is required')
    })

    it('should be fulfilled given the broker.publish calls are fulfilled', function () {
      mockBroker.publish = function () {
        return Promise.resolve()
      }

      return expect(publisher.publish('something-happened')).to.be.fulfilled
    })

    it('should be rejected given the broker.publish call is rejected', function () {
      let brokerPromise = Promise.reject(new Error('Aw, snap!'))

      mockBroker.publish = function () {
        return brokerPromise
      }

      return expect(publisher.publish('something-happened')).to.be.rejectedWith('Aw, snap!')
    })

    it('should be rejected given the middleware rejects the message', function () {
      publisher.use(function (message, actions) {
        actions.error(new Error('Aw, snap!'))
      })

      return expect(publisher.publish('something-happened')).to.be.rejectedWith('Aw, snap!')
    })

    it('should call middleware with the message', function () {
      let middlewareCalled = false
      publisher.use(function (message, actions) {
        middlewareCalled = true
        actions.next()
      })

      return publisher.publish('something-happened').then(function () {
        expect(middlewareCalled).to.equal(true)
      })
    })

    it('should set persistent to true by default', function () {
      sinon.spy(mockBroker, 'publish')

      return publisher.publish('something-happened').then(function () {
        expect(mockBroker.publish).to.have.been.calledWith('publish', sinon.match({ routingKey: 'something-happened', payload: null, persistent: true }))
      })
    })

    it('should copy properties from the properties property of the message to the publish options', function () {
      sinon.spy(mockBroker, 'publish')

      return publisher.publish('something-happened').then(function () {
        expect(mockBroker.publish).to.have.been.calledWith('publish', sinon.match({ routingKey: 'something-happened', payload: null, type: 'something-happened' }))
      })
    })

    it('should copy properties from the publishOptions property of the options to the publish options', function () {
      let options = {
        publishOptions: {
          correlationId: '123'
        }
      }

      sinon.spy(mockBroker, 'publish')

      return publisher.publish('something-happened', null, options).then(function () {
        expect(mockBroker.publish).to.have.been.calledWith('publish', sinon.match({ routingKey: 'something-happened', payload: null, correlationId: '123' }))
      })
    })

    it('should overwrite publish options set from anywhere else with values from the publishOptions property of the options', function () {
      let options = {
        publishOptions: {
          persistent: false
        }
      }

      sinon.spy(mockBroker, 'publish')

      return publisher.publish('something-happened', null, options).then(function () {
        expect(mockBroker.publish).to.have.been.calledWith('publish', sinon.match({ routingKey: 'something-happened', payload: null, persistent: false }))
      })
    })
  })
})
