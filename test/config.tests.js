const Configurator = require('../lib/config/config')
const Logger = require('../lib/logger')
const { EventEmitter } = require('events')

describe('Configurator', () => {
  let configurator
  let broker
  let events
  let logger

  beforeEach(() => {
    broker = {
      getTopologyParams: () => ({})
    }
    events = new EventEmitter()
    logger = Logger('magicbus.tests', events)
    configurator = Configurator(logger, events)
  })

  it('should support overriding the logger', () => {
    configurator.useLogger(Logger('magicbus.tests2', events))
  })

  it('should support overriding the logger using a factory function', () => {
    configurator.useLoggerFactory(() => Logger('magicbus.tests2', events))
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

    it('should support string connection info', () => {
      let broker = configurator.createBroker(serviceDomainName, appName, 'amqp://guest:guest@localhost/')

      expect(broker).toBeTruthy()
      expect(broker.shutdown).toBeTruthy()
      return broker.shutdown()
    })

    it('should support minimal connection string', () => {
      let broker = configurator.createBroker(serviceDomainName, appName, 'amqp://localhost')

      expect(broker).toBeTruthy()
      expect(broker.shutdown).toBeTruthy()
      return broker.shutdown()
    })

    it('should allow caller to override the logger', () => {
      let myLogger = Logger('broker-only', events)
      let broker = configurator.createBroker(serviceDomainName, appName, connectionInfo,
        (cfg) => cfg.useLogger(myLogger))

      expect(broker).toBeTruthy()
      return broker.shutdown()
    })

    it('should allow caller to override the logger using a factory function', () => {
      let myLogger = Logger('broker-only', events)
      let broker = configurator.createBroker(serviceDomainName, appName, connectionInfo,
        (cfg) => cfg.useLoggerFactory(() => myLogger))

      expect(broker).toBeTruthy()
      return broker.shutdown()
    })
  })

  describe('#createPublisher', () => {
    it('should create a publisher with the default params', () => {
      let publisher = configurator.createPublisher(broker)

      expect(publisher).toBeTruthy()
    })

    it('should allow caller to override implementations', () => {
      let publisher = configurator.createPublisher(broker,
        (cfg) =>
          cfg
            .useTopology(() => {})
            .useEnvelope({ wrap: () => {} })
            .useSerializer(() => {})
            .useFilter(() => {})
            .useRouteName('my-route')
      )

      expect(publisher).toBeTruthy()
    })

    it('should allow caller to override implementations using factories', () => {
      let publisher = configurator.createPublisher(broker,
        (cfg) =>
          cfg
            .useTopologyFactory(() => ({}))
            .useEnvelopeFactory(() => ({}))
            .useSerializerFactory(() => ({}))
            .useRouteName(() => 'my-route')
      )

      expect(publisher).toBeTruthy()
    })

    it('should allow caller to use default topology with defaults', () => {
      let publisher = configurator.createPublisher(broker,
        (cfg) => cfg.useDefaultTopology()
      )

      expect(publisher).toBeTruthy()
    })

    it('should allow caller to use default topology with custom params', () => {
      let publisher = configurator.createPublisher(broker,
        (cfg) => cfg.useDefaultTopology({ exchangeType: 'fanout', durable: false, autoDelete: true })
      )

      expect(publisher).toBeTruthy()
    })

    it('should allow caller to use json serialization with defaults', () => {
      let publisher = configurator.createPublisher(broker,
        (cfg) => cfg.useJson()
      )

      expect(publisher).toBeTruthy()
    })

    it('should allow caller to use json serialization with custom params', () => {
      let publisher = configurator.createPublisher(broker,
        (cfg) =>
          cfg.useJson({ encoding: 'ascii', contentTypeSuffix: '-json' })
      )

      expect(publisher).toBeTruthy()
    })

    it('should allow caller to use magic envelope with defaults', () => {
      let publisher = configurator.createPublisher(broker,
        (cfg) =>
          cfg.useMagicEnvelope()
      )

      expect(publisher).toBeTruthy()
    })

    it('should allow caller to use magic envelope with custom params', () => {
      let publisher = configurator.createPublisher(broker,
        (cfg) =>
          cfg.useMagicEnvelope({ contentType: 'application/json' })
      )

      expect(publisher).toBeTruthy()
    })

    it('should allow caller to use a custom filter', () => {
      let publisher = configurator.createPublisher(broker,
        (cfg) => cfg.useFilter(() => {})
      )

      expect(publisher).toBeTruthy()
    })

    it('should allow caller to use a custom filter with a factory', () => {
      let publisher = configurator.createPublisher(broker,
        (cfg) => cfg.useFilterFactory(() => () => {})
      )

      expect(publisher).toBeTruthy()
    })

    it('should allow caller to completely override input filters', () => {
      let publisher = configurator.createPublisher(broker,
        (cfg) => cfg.overrideFilters({ input: [() => {}] })
      )

      expect(publisher).toBeTruthy()
    })

    it('should allow caller to completely override output filters', () => {
      let publisher = configurator.createPublisher(broker,
        (cfg) => cfg.overrideFilters({ output: [() => {}] })
      )

      expect(publisher).toBeTruthy()
    })
  })

  describe('#createConsumer', () => {
    it('should create a consumer with the default params', () => {
      let consumer = configurator.createConsumer(broker)

      expect(consumer).toBeTruthy()
    })

    it('should allow caller to override implementations', () => {
      let consumer = configurator.createConsumer(broker,
        (cfg) =>
          cfg
            .useTopology({})
            .useEnvelope({})
            .useDeserializer({})
            .useRouteName('my-route')
      )

      expect(consumer).toBeTruthy()
    })

    it('should allow caller to override implementations using factories', () => {
      let consumer = configurator.createConsumer(broker,
        (cfg) =>
          cfg
            .useTopologyFactory(() => ({}))
            .useEnvelopeFactory(() => ({}))
            .useDeserializerFactory(() => ({}))
            .useRouteName(() => 'my-route')
      )

      expect(consumer).toBeTruthy()
    })

    it('should allow caller to use default topology with defaults', () => {
      let consumer = configurator.createConsumer(broker,
        (cfg) => cfg.useDefaultTopology()
      )

      expect(consumer).toBeTruthy()
    })

    it('should allow caller to use default topology with custom params', () => {
      let consumer = configurator.createConsumer(broker,
        (cfg) => cfg.useDefaultTopology({ noAck: true, durable: false, autoDelete: true, exclusive: true })
      )

      expect(consumer).toBeTruthy()
    })

    it('should allow caller to use json serialization with defaults', () => {
      let consumer = configurator.createConsumer(broker,
        (cfg) => cfg.useJson()
      )

      expect(consumer).toBeTruthy()
    })

    it('should allow caller to use json serialization with custom params', () => {
      let consumer = configurator.createConsumer(broker,
        (cfg) =>
          cfg.useJson({ encoding: 'ascii' })
      )

      expect(consumer).toBeTruthy()
    })

    it('should allow caller to use magic envelope with defaults', () => {
      let consumer = configurator.createConsumer(broker,
        (cfg) =>
          cfg.useMagicEnvelope()
      )

      expect(consumer).toBeTruthy()
    })

    it('should allow caller to use magic envelope with custom params', () => {
      let consumer = configurator.createConsumer(broker,
        (cfg) =>
          cfg.useMagicEnvelope({ contentType: 'application/json' })
      )

      expect(consumer).toBeTruthy()
    })

    it('should allow caller to use a custom filter', () => {
      let consumer = configurator.createConsumer(broker,
        (cfg) => cfg.useFilter(() => {})
      )

      expect(consumer).toBeTruthy()
    })

    it('should allow caller to use a custom filter with a factory', () => {
      let consumer = configurator.createConsumer(broker,
        (cfg) => cfg.useFilterFactory(() => () => {})
      )

      expect(consumer).toBeTruthy()
    })

    it('should allow caller to completely override consume filters', () => {
      let consumer = configurator.createConsumer(broker,
        (cfg) => cfg.overrideFilters({ consume: [() => {}] })
      )

      expect(consumer).toBeTruthy()
    })

    it('should allow caller to completely override input filters', () => {
      let consumer = configurator.createConsumer(broker,
        (cfg) => cfg.overrideFilters({ input: [() => {}] })
      )

      expect(consumer).toBeTruthy()
    })

    it('should allow caller to completely override output filters', () => {
      let consumer = configurator.createConsumer(broker,
        (cfg) => cfg.overrideFilters({ output: [() => {}] })
      )

      expect(consumer).toBeTruthy()
    })
  })

  describe('#createSubscriber', () => {
    it('should create a subscriber with the default params', () => {
      let subscriber = configurator.createSubscriber(broker)

      expect(subscriber).toBeTruthy()
    })

    it('should allow caller to override consumer implementations', () => {
      let subscriber = configurator.createSubscriber(broker,
        (cfg) =>
          cfg.useEnvelope({})
            .useDeserializer({})
            .useRouteName('my-route')
      )

      expect(subscriber).toBeTruthy()
    })

    it('should allow caller to override consumer implementations using factories', () => {
      let subscriber = configurator.createSubscriber(broker,
        (cfg) =>
          cfg.useEnvelopeFactory(() => ({}))
            .useDeserializerFactory(() => ({}))
            .useRouteName(() => 'my-route')
      )

      expect(subscriber).toBeTruthy()
    })

    it('should allow caller to override the consumer', () => {
      let myConsumer = {}
      let subscriber = configurator.createSubscriber((cfg) => cfg.useConsumer(myConsumer))

      expect(subscriber).toBeTruthy()
    })

    it('should allow caller to override the consumer using a factory function', () => {
      let myConsumer = {}
      let subscriber = configurator.createSubscriber((cfg) => cfg.useConsumerFactory(() => myConsumer))

      expect(subscriber).toBeTruthy()
    })

    it('should allow caller to override the event dispatcher', () => {
      let myEventDispatcher = {}
      let subscriber = configurator.createSubscriber(broker, (cfg) => cfg.useEventDispatcher(myEventDispatcher))

      expect(subscriber).toBeTruthy()
    })

    it('should allow caller to override the event dispatcher using a factory function', () => {
      let myEventDispatcher = {}
      let subscriber = configurator.createSubscriber(broker,
        (cfg) => cfg.useEventDispatcherFactory(() => myEventDispatcher))

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
