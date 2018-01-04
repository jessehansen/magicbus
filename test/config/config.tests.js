
const Configurator = require('../../lib/config')
const Logger = require('../../lib/logger')
const EventEmitter = require('events').EventEmitter

const chai = require('chai')
const expect = chai.expect

describe('Configurator', function () {
  let configurator
  let broker
  let events
  let logger

  beforeEach(function () {
    broker = {
      registerRoute: function () {}
    }
    events = new EventEmitter()
    logger = Logger('magicbus.tests', events)
    configurator = new Configurator(logger, events)
  })

  describe('#createBroker', function () {
    let serviceDomainName = 'my-domain'
    let appName = 'my-app'
    let connectionInfo = {
      server: 'localhost',
      vhost: '/',
      user: 'guest',
      pass: 'guest'
    }

    it('should create a broker with the default params', function () {
      let broker = configurator.createBroker(serviceDomainName, appName, connectionInfo)

      expect(broker).to.be.ok
      expect(broker.shutdown).to.be.ok
      return broker.shutdown()
    })
  })

  describe('#createPublisher', function () {
    it('should create a publisher with the default params', function () {
      let publisher = configurator.createPublisher(broker)

      expect(publisher).to.be.ok
    })

    it('should allow caller to override the envelope', function () {
      let myEnvelope = {}
      let publisher = configurator.createPublisher(broker, function (cfg) {
        cfg.useEnvelope(myEnvelope)
      })

      expect(publisher).to.be.ok
    })

    it('should allow caller to override the middleware pipeline', function () {
      let myPipeline = { useLogger: function () {} }
      let publisher = configurator.createPublisher(broker, function (cfg) {
        cfg.usePipeline(myPipeline)
      })

      expect(publisher).to.be.ok
    })

    it('should allow caller to override the route name', function () {
      let myRouteName = 'publish2'
      let publisher = configurator.createPublisher(broker, function (cfg) {
        cfg.useRouteName(myRouteName)
      })

      expect(publisher).to.be.ok
    })

    it('should allow caller to override the route pattern', function () {
      let myRoutePattern = {}
      let publisher = configurator.createPublisher(broker, function (cfg) {
        cfg.useRoutePattern(myRoutePattern)
      })

      expect(publisher).to.be.ok
    })
  })

  describe('#createConsumer', function () {
    it('should create a consumer with the default params', function () {
      let consumer = configurator.createConsumer(broker)

      expect(consumer).to.be.ok
    })

    it('should allow caller to override the envelope', function () {
      let myEnvelope = {}
      let consumer = configurator.createConsumer(broker, function (cfg) {
        cfg.useEnvelope(myEnvelope)
      })

      expect(consumer).to.be.ok
    })

    it('should allow caller to override the middleware pipeline', function () {
      let myPipeline = { useLogger: function () {} }
      let consumer = configurator.createConsumer(broker, function (cfg) {
        cfg.usePipeline(myPipeline)
      })

      expect(consumer).to.be.ok
    })

    it('should allow caller to override the route name', function () {
      let myRouteName = 'publish2'
      let consumer = configurator.createConsumer(broker, function (cfg) {
        cfg.useRouteName(myRouteName)
      })

      expect(consumer).to.be.ok
    })

    it('should allow caller to override the route pattern', function () {
      let myRoutePattern = {}
      let consumer = configurator.createConsumer(broker, function (cfg) {
        cfg.useRoutePattern(myRoutePattern)
      })

      expect(consumer).to.be.ok
    })
  })

  describe('#createSubscriber', function () {
    it('should create a subscriber with the default params', function () {
      let subscriber = configurator.createSubscriber(broker)

      expect(subscriber).to.be.ok
    })

    it('should allow caller to override the envelope', function () {
      let myEnvelope = {}
      let subscriber = configurator.createSubscriber(broker, function (cfg) {
        cfg.useEnvelope(myEnvelope)
      })

      expect(subscriber).to.be.ok
    })

    it('should allow caller to override the middleware pipeline', function () {
      let myPipeline = { useLogger: function () {} }
      let subscriber = configurator.createSubscriber(broker, function (cfg) {
        cfg.usePipeline(myPipeline)
      })

      expect(subscriber).to.be.ok
    })

    it('should allow caller to override the route name', function () {
      let myRouteName = 'publish2'
      let subscriber = configurator.createSubscriber(broker, function (cfg) {
        cfg.useRouteName(myRouteName)
      })

      expect(subscriber).to.be.ok
    })

    it('should allow caller to override the route pattern', function () {
      let myRoutePattern = {}
      let subscriber = configurator.createSubscriber(broker, function (cfg) {
        cfg.useRoutePattern(myRoutePattern)
      })

      expect(subscriber).to.be.ok
    })

    it('should allow caller to override the consumer', function () {
      let myConsumer = {}
      let subscriber = configurator.createSubscriber(function (cfg) {
        cfg.useConsumer(myConsumer)
      })

      expect(subscriber).to.be.ok
    })
  })

  describe('#createBinder', function () {
    let connectionInfo = {
      server: 'localhost',
      vhost: '/',
      user: 'guest',
      pass: 'guest'
    }

    it('should create a binder with the default params', function () {
      let binder = configurator.createBinder(connectionInfo)

      expect(binder).to.be.ok
      expect(binder.bind).to.be.ok
      return binder.shutdown()
    })
  })
})
