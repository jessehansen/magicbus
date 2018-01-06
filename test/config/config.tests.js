const Configurator = require('../../lib/config')
const Logger = require('../../lib/logger')
const EventEmitter = require('events').EventEmitter

describe('Configurator', () => {
  let configurator
  let broker
  let events
  let logger

  beforeEach(() => {
    broker = {
      registerRoute: () => {}
    }
    events = new EventEmitter()
    logger = Logger('magicbus.tests', events)
    configurator = new Configurator(logger, events)
  })

  describe('#createBroker', () => {
    let serviceDomainName = 'my-domain'
    let appName = 'my-app'
    let connectionInfo = {
      server: 'localhost',
      vhost: '/',
      user: 'guest',
      pass: 'guest'
    }

    it('should create a broker with the default params', () => {
      let broker = configurator.createBroker(serviceDomainName, appName, connectionInfo)

      expect(broker).toBeTruthy()
      expect(broker.shutdown).toBeTruthy()
      return broker.shutdown()
    })
  })

  describe('#createPublisher', () => {
    it('should create a publisher with the default params', () => {
      let publisher = configurator.createPublisher(broker)

      expect(publisher).toBeTruthy()
    })

    it('should allow caller to override the envelope', () => {
      let myEnvelope = {}
      let publisher = configurator.createPublisher(broker, (cfg) => cfg.useEnvelope(myEnvelope))

      expect(publisher).toBeTruthy()
    })

    it('should allow caller to override the middleware pipeline', () => {
      let myPipeline = { useLogger: () => {} }
      let publisher = configurator.createPublisher(broker, (cfg) => cfg.usePipeline(myPipeline))

      expect(publisher).toBeTruthy()
    })

    it('should allow caller to override the route name', () => {
      let myRouteName = 'publish2'
      let publisher = configurator.createPublisher(broker, (cfg) => cfg.useRouteName(myRouteName))

      expect(publisher).toBeTruthy()
    })

    it('should allow caller to override the route pattern', () => {
      let myRoutePattern = () => () => ({ exchangeName: 'my exchange name' })
      let publisher = configurator.createPublisher(broker, (cfg) => cfg.useRoutePattern(myRoutePattern))

      expect(publisher).toBeTruthy()
    })
  })

  describe('#createConsumer', () => {
    it('should create a consumer with the default params', () => {
      let consumer = configurator.createConsumer(broker)

      expect(consumer).toBeTruthy()
    })

    it('should allow caller to override the envelope', () => {
      let myEnvelope = {}
      let consumer = configurator.createConsumer(broker, (cfg) => cfg.useEnvelope(myEnvelope))

      expect(consumer).toBeTruthy()
    })

    it('should allow caller to override the middleware pipeline', () => {
      let myPipeline = { useLogger: () => {} }
      let consumer = configurator.createConsumer(broker, (cfg) => cfg.usePipeline(myPipeline))

      expect(consumer).toBeTruthy()
    })

    it('should allow caller to override the route name', () => {
      let myRouteName = 'publish2'
      let consumer = configurator.createConsumer(broker, (cfg) => cfg.useRouteName(myRouteName))

      expect(consumer).toBeTruthy()
    })

    it('should allow caller to override the route pattern', () => {
      let myRoutePattern = () => () => ({ queueName: 'my queue name' })
      let consumer = configurator.createConsumer(broker, (cfg) => cfg.useRoutePattern(myRoutePattern))

      expect(consumer).toBeTruthy()
    })
  })

  describe('#createSubscriber', () => {
    it('should create a subscriber with the default params', () => {
      let subscriber = configurator.createSubscriber(broker)

      expect(subscriber).toBeTruthy()
    })

    it('should allow caller to override the envelope', () => {
      let myEnvelope = {}
      let subscriber = configurator.createSubscriber(broker, (cfg) => cfg.useEnvelope(myEnvelope))

      expect(subscriber).toBeTruthy()
    })

    it('should allow caller to override the middleware pipeline', () => {
      let myPipeline = { useLogger: () => {} }
      let subscriber = configurator.createSubscriber(broker, (cfg) => cfg.usePipeline(myPipeline))

      expect(subscriber).toBeTruthy()
    })

    it('should allow caller to override the route name', () => {
      let myRouteName = 'publish2'
      let subscriber = configurator.createSubscriber(broker, (cfg) => cfg.useRouteName(myRouteName))

      expect(subscriber).toBeTruthy()
    })

    it('should allow caller to override the route pattern', () => {
      let myRoutePattern = () => () => ({ queueName: 'my queue name' })
      let subscriber = configurator.createSubscriber(broker, (cfg) => cfg.useRoutePattern(myRoutePattern))

      expect(subscriber).toBeTruthy()
    })

    it('should allow caller to override the consumer', () => {
      let myConsumer = {}
      let subscriber = configurator.createSubscriber((cfg) => cfg.useConsumer(myConsumer))

      expect(subscriber).toBeTruthy()
    })
  })

  describe('#createBinder', () => {
    let connectionInfo = {
      server: 'localhost',
      vhost: '/',
      user: 'guest',
      pass: 'guest'
    }

    it('should create a binder with the default params', () => {
      let binder = configurator.createBinder(connectionInfo)

      expect(binder).toBeTruthy()
      expect(binder.bind).toBeTruthy()
      return binder.shutdown()
    })
  })
})
