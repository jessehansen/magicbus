const Topology = require('../lib/topology')
const FakeMachine = require('./_fake-machine')
const Monologue = require('monologue.js')
const { EventEmitter } = require('events')

const Logger = require('../lib/logger')
const { delay } = require('../lib/util')
describe('Topology', () => {
  let mockConnection
  let mockChannel
  let logger
  let emitter
  let ExchangeMachine
  let QueueMachine

  beforeEach(() => {
    emitter = new Monologue()
    mockConnection = {
      createChannel: jest.fn(() => mockChannel),
      addQueue: jest.fn(() => Promise.resolve()),
      on: (event, handler) => emitter.on(event, handler),
      reset: () => 0,
      lastError: () => null
    }
    mockChannel = {
      bindQueue: jest.fn((/* target, source, key */) => Promise.resolve()),
      bindExchange: jest.fn((/* target, source, key */) => Promise.resolve()),
      check: jest.fn(() => Promise.resolve()),
      destroy: jest.fn(() => Promise.resolve()),
      deleteQueue: jest.fn(() => Promise.resolve()),
      deleteExchange: jest.fn(() => Promise.resolve()),
      assertQueue: jest.fn(() => Promise.resolve()),
      assertExchange: jest.fn(() => Promise.resolve()),
      once: () => 0,
      on: () => 0
    }
    logger = Logger('tests', new EventEmitter())

    ExchangeMachine = FakeMachine
    QueueMachine = FakeMachine
  })

  const constructTopology = () => Topology(mockConnection, logger, ExchangeMachine, QueueMachine)

  describe('constructor', () => {
    it('should call onReconnect when reconnected', () => {
      let topology = constructTopology()
      topology.onReconnect = jest.fn(topology.onReconnect)

      emitter.emit('reconnected')

      expect(topology.onReconnect).toHaveBeenCalledWith()
    })
    it('should call check supporting channels', async () => {
      let topology = constructTopology()
      topology.getOrCreateChannel('control')

      emitter.emit('reconnected')
      await delay(1)

      expect(mockChannel.check).toHaveBeenCalledWith()
    })
    it('should be ok when channel does not support check', () => {
      let topology = constructTopology()
      delete mockChannel.check
      topology.getOrCreateChannel('control')

      emitter.emit('reconnected')
    })
    it('should configure bindings upon reconnect', async () => {
      let topology = constructTopology()
      topology.configureBindings = jest.fn(topology.configureBindings)

      await topology.createBinding({
        queue: true,
        source: 'some-exchange',
        target: 'some-queue',
        keys: 'some-key'
      })

      emitter.emit('reconnected')
      await delay(1)

      expect(topology.configureBindings).toHaveBeenCalledWith(topology.definitions.bindings, true)
    })
  })

  describe('configureBindings', () => {
    let topology

    beforeEach(() => {
      topology = constructTopology()
    })

    it('can be called with no arguments', async () => {
      await topology.configureBindings()
    })

    it('can be called with empty array', async () => {
      await topology.configureBindings([])
    })

    it('can be called with a single binding', async () => {
      await topology.configureBindings({ queue: true, source: 'some-exchange', target: 'some-queue' })
      expect(mockChannel.bindQueue).toHaveBeenCalledWith('some-queue', 'some-exchange', '')
    })

    it('can be called with an array', async () => {
      await topology.configureBindings([
        { queue: true, source: 'some-exchange', target: 'some-queue' },
        { queue: true, source: 'some-exchange', target: 'some-other-queue' }
      ])
      expect(mockChannel.bindQueue).toHaveBeenCalledWith('some-queue', 'some-exchange', '')
      expect(mockChannel.bindQueue).toHaveBeenCalledWith('some-other-queue', 'some-exchange', '')
    })

    it('can be called with an object', async () => {
      await topology.configureBindings({
        'some-exchange->some-queue': { queue: true, source: 'some-exchange', target: 'some-queue' },
        'some-exchange->some-other-queue': { queue: true, source: 'some-exchange', target: 'some-other-queue' }
      }, true)
      expect(mockChannel.bindQueue).toHaveBeenCalledWith('some-queue', 'some-exchange', '')
      expect(mockChannel.bindQueue).toHaveBeenCalledWith('some-other-queue', 'some-exchange', '')
    })

    it('can infer that binding is to a queue when queue was previously configured', async () => {
      await topology.createQueue({ name: 'some-queue' })
      await topology.configureBindings({ source: 'some-exchange', target: 'some-queue' })
      expect(mockChannel.bindQueue).toHaveBeenCalledWith('some-queue', 'some-exchange', '')
    })

    it('can infer that binding is to an exchange when no queue was previously configured', async () => {
      await topology.configureBindings({ source: 'some-exchange', target: 'some-other-exchange' })
      expect(mockChannel.bindExchange).toHaveBeenCalledWith('some-other-exchange', 'some-exchange', '')
    })
  })

  describe('#createBinding', () => {
    let topology

    beforeEach(() => {
      topology = constructTopology()
    })

    it('should call bindQueue when target is a queue', async () => {
      await topology.createBinding({
        queue: true,
        source: 'some-exchange',
        target: 'some-queue'
      })

      expect(mockChannel.bindQueue).toHaveBeenCalledWith('some-queue', 'some-exchange', '')
    })

    it('should return previous promise when called with same args twice', async () => {
      let params = {
        queue: true,
        source: 'some-exchange',
        target: 'some-queue'
      }

      await topology.createBinding(params)
      await topology.createBinding(params)

      expect(mockChannel.bindQueue).toHaveBeenCalledWith('some-queue', 'some-exchange', '')
      expect(mockChannel.bindQueue).toHaveBeenCalledTimes(1)
    })

    it('should call bindExchange when target is an exchange', async () => {
      await topology.createBinding({
        queue: false,
        source: 'some-exchange',
        target: 'some-other-exchange'
      })

      expect(mockChannel.bindExchange).toHaveBeenCalledWith('some-other-exchange', 'some-exchange', '')
    })

    it('should support passing a single routing key', async () => {
      await topology.createBinding({
        queue: true,
        source: 'some-exchange',
        target: 'some-queue',
        keys: 'some-key'
      })

      expect(mockChannel.bindQueue).toHaveBeenCalledWith('some-queue', 'some-exchange', 'some-key')
    })

    it('should support passing multiple routing keys', async () => {
      await topology.createBinding({
        queue: true,
        source: 'some-exchange',
        target: 'some-queue',
        keys: ['some-key', 'some-other-key']
      })

      expect(mockChannel.bindQueue).toHaveBeenCalledWith('some-queue', 'some-exchange', 'some-key')
      expect(mockChannel.bindQueue).toHaveBeenCalledWith('some-queue', 'some-exchange', 'some-other-key')
    })
  })

  describe('#getOrCreateChannel', () => {
    let topology

    beforeEach(() => {
      topology = constructTopology()
    })

    it('should create a channel', async () => {
      let channel = await topology.getOrCreateChannel('control')

      expect(channel).toEqual(mockChannel)
    })

    it('should not create a second channel for the same name', async () => {
      await topology.getOrCreateChannel('control')
      await topology.getOrCreateChannel('control')

      expect(mockConnection.createChannel).toHaveBeenCalledTimes(1)
    })
  })

  describe('#channel', () => {
    let topology

    beforeEach(async () => {
      topology = constructTopology()
      await topology.getOrCreateChannel('control')
    })

    it('should get an existing channel', async () => {
      let channel = topology.channel('control')
      expect(channel).toEqual(mockChannel)
    })

    it('should throw an error if the channel does not exist', async () => {
      expect(() => topology.channel('bogus')).toThrow('No channel bogus')
    })
  })

  describe('#reset', () => {
    let topology

    beforeEach(() => {
      topology = constructTopology()
    })

    it('should destroy all channels', async () => {
      await topology.getOrCreateChannel('control')

      topology.reset()

      expect(mockChannel.destroy).toHaveBeenCalledWith()
      expect(topology.channels).toEqual({})
    })

    it('should forget all existing definitions', async () => {
      await topology.createQueue({ name: 'some-queue' })
      await topology.createExchange({ name: 'some-exchange' })

      await topology.createBinding({
        queue: true,
        source: 'some-exchange',
        target: 'some-queue'
      })

      topology.reset()

      expect(topology.definitions.queues).toEqual({})
      expect(topology.definitions.exchanges).toEqual({})
      expect(topology.definitions.bindings).toEqual({})
    })
  })

  describe('#createQueue', () => {
    let topology

    beforeEach(async () => {
      topology = constructTopology()
    })

    it('should store the definition', async () => {
      const queueOptions = { name: 'my-test-queue' }
      await topology.createQueue(queueOptions)
      expect(topology.definitions.queues).toEqual({ 'my-test-queue': queueOptions })
    })

    it('should create and store the channel', async () => {
      await topology.createQueue({ name: 'my-test-queue' })
      expect(topology.channel('queue:my-test-queue')).toBeTruthy()
    })

    it('should reject if the queue machine fails', async () => {
      QueueMachine = FakeMachine.fails
      topology = constructTopology()
      await expect(topology.createQueue({ name: 'my-test-queue' })).rejects.toThrow()
    })

    it('should reject if the connection has failed', async () => {
      mockConnection.state = 'failed'
      await expect(topology.createQueue({ name: 'my-test-queue' })).rejects.toThrow()
    })

    it('should reject if the connection fails during creation', async () => {
      QueueMachine = FakeMachine.hangs
      process.nextTick(() => emitter.emit('failed', 'error'))
      await expect(topology.createQueue({ name: 'my-test-queue' })).rejects.toThrow()
    })
  })

  describe('#connectQueue', () => {
    let topology

    beforeEach(async () => {
      topology = constructTopology()
    })

    it('should store the definition', async () => {
      await topology.connectQueue('my-connect-queue')
      expect(topology.definitions.queues).toEqual({ 'my-connect-queue': { name: 'my-connect-queue', check: true } })
    })
  })

  describe('#createExchange', () => {
    let topology

    beforeEach(async () => {
      topology = constructTopology()
    })

    it('should store the definition', async () => {
      const exchangeOptions = { name: 'my-test-exchange' }
      await topology.createExchange(exchangeOptions)
      expect(topology.definitions.exchanges).toEqual({ 'my-test-exchange': exchangeOptions })
    })

    it('should create and store the channel', async () => {
      await topology.createExchange({ name: 'my-test-exchange' })
      expect(topology.channel('exchange:my-test-exchange')).toBeTruthy()
    })

    it('should reject if the exchange machine fails', async () => {
      ExchangeMachine = FakeMachine.fails
      topology = constructTopology()
      await expect(topology.createExchange({ name: 'my-test-exchange' })).rejects.toThrow()
    })

    it('should reject if the connection has failed', async () => {
      mockConnection.state = 'failed'
      await expect(topology.createExchange({ name: 'my-test-exchange' })).rejects.toThrow()
    })

    it('should reject if the connection fails during creation', async () => {
      ExchangeMachine = FakeMachine.hangs
      process.nextTick(() => emitter.emit('failed', 'error'))
      await expect(topology.createExchange({ name: 'my-test-exchange' })).rejects.toThrow()
    })
  })

  describe('#connectExchange', () => {
    let topology

    beforeEach(async () => {
      topology = constructTopology()
    })

    it('should store the definition', async () => {
      await topology.connectExchange('my-connect-exchange')
      expect(topology.definitions.exchanges).toEqual({ 'my-connect-exchange': { name: 'my-connect-exchange', check: true } })
    })
  })

  describe('#deleteQueue', () => {
    let topology

    beforeEach(async () => {
      topology = constructTopology()
    })

    it('should delete it on the control channel', async () => {
      await topology.deleteQueue('some-queue')
      expect(mockChannel.deleteQueue).toHaveBeenCalledWith('some-queue')
    })

    it('should destroy the queue channel if it was created', async () => {
      await topology.createQueue({ name: 'some-queue' })
      let queueChannel = topology.channels['queue:some-queue']
      expect(queueChannel).toBeTruthy()
      topology.channels['queue:some-queue'].destroy = jest.fn(() => Promise.resolve())
      await topology.deleteQueue('some-queue')
      expect(queueChannel.destroy).toHaveBeenCalled()
      expect(topology.channels['queue:some-queue']).toBeUndefined()
    })
  })

  describe('#deleteExchange', () => {
    let topology

    beforeEach(async () => {
      topology = constructTopology()
    })

    it('should delete it on the control channel', async () => {
      await topology.deleteExchange('some-exchange')
      expect(mockChannel.deleteExchange).toHaveBeenCalledWith('some-exchange')
    })

    it('should destroy the exchange channel if it was created', async () => {
      await topology.createExchange({ name: 'some-exchange' })
      let exchangeChannel = topology.channels['exchange:some-exchange']
      expect(exchangeChannel).toBeTruthy()
      topology.channels['exchange:some-exchange'].destroy = jest.fn(() => Promise.resolve())
      await topology.deleteExchange('some-exchange')
      expect(exchangeChannel.destroy).toHaveBeenCalled()
      expect(topology.channels['exchange:some-exchange']).toBeUndefined()
    })
  })
})
