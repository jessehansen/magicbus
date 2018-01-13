const createTopology = require('../lib/topology')
const FakeMachine = require('./_fake-machine')
const Monologue = require('monologue.js')

const Logger = require('../lib/logger')
const { delay } = require('../lib/util')
describe('Topology', () => {
  let mockConnection
  let mockChannel
  let logger
  let emitter

  beforeEach(() => {
    emitter = new Monologue()
    mockConnection = {
      createChannel: jest.fn(() => mockChannel),
      addQueue: jest.fn(() => Promise.resolve()),
      on: (event, handler) => emitter.on(event, handler),
      reset: () => 0
    }
    mockChannel = {
      bindQueue: jest.fn((/* target, source, key */) => Promise.resolve()),
      bindExchange: jest.fn((/* target, source, key */) => Promise.resolve()),
      check: jest.fn(() => Promise.resolve()),
      destroy: jest.fn(() => Promise.resolve()),
      assertQueue: jest.fn(() => Promise.resolve()),
      assertExchange: jest.fn(() => Promise.resolve()),
      once: () => 0,
      on: () => 0
    }
    logger = Logger()
  })

  const constructTopology = () => createTopology(mockConnection, logger, FakeMachine, FakeMachine)

  describe('constructor', () => {
    it('should call onReconnect when reconnected', () => {
      let topology = constructTopology()
      topology.onReconnect = jest.fn(topology.onReconnect)

      emitter.emit('reconnected')

      expect(topology.onReconnect).toHaveBeenCalledWith()
    })
    it('should call check supporting channels', async () => {
      let topology = constructTopology()
      topology.getChannel('control')

      emitter.emit('reconnected')
      await delay(1)

      expect(mockChannel.check).toHaveBeenCalledWith()
    })
    it('should be ok when channel does not support check', () => {
      let topology = constructTopology()
      delete mockChannel.check
      topology.getChannel('control')

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

  describe('#getChannel', () => {
    let topology

    beforeEach(() => {
      topology = constructTopology()
    })

    it('should create a channel', async () => {
      let channel = await topology.getChannel('control')

      expect(channel).toEqual(mockChannel)
    })

    it('should not create a second channel for the same name', async () => {
      await topology.getChannel('control')
      await topology.getChannel('control')

      expect(mockConnection.createChannel).toHaveBeenCalledTimes(1)
    })
  })

  describe('#reset', () => {
    let topology

    beforeEach(() => {
      topology = constructTopology()
    })

    it('should destroy all channels', async () => {
      await topology.getChannel('control')

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
})
