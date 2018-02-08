const ConnectionMachine = require('../lib/connection-machine')
const { EventEmitter } = require('events')
const Logger = require('../lib/logger')
const { tick } = require('../lib/util')
const FakeMachine = require('./_fake-machine')

const FakeAmqpConnection = (options, logger) => {
  const emitter = new EventEmitter()
  return {
    passedOptions: options,
    passedLogger: logger,
    acquire: jest.fn(() => Promise.resolve()),
    destroy: jest.fn(),
    close: jest.fn(),

    simulate: (event) => {
      emitter.emit(event)
    },

    on: (...args) => emitter.on(...args)
  }
}

FakeAmqpConnection.tap = (tapper) => (...args) => {
  const result = FakeAmqpConnection(...args)
  tapper(result)
  return result
}

describe('ConnectionMachine', () => {
  let options
  let logger
  let ConnectionFactory
  let amqpConnection
  let ChannelFactory
  let connection

  beforeEach(() => {
    options = { name: 'frank' }
    logger = Logger('tests', new EventEmitter())
    ConnectionFactory = FakeAmqpConnection.tap((c) => {
      amqpConnection = c
    })
    ChannelFactory = FakeMachine
    connection = ConnectionMachine(options, logger, ConnectionFactory, ChannelFactory)
  })

  it('should attempt to acquire connection after it moves to acquiring', async () => {
    amqpConnection.simulate('acquiring')
    await tick()
    expect(amqpConnection.acquire).toHaveBeenCalled()
    expect(connection.state).toBe('connecting')
  })

  it('should emit connected after connection is acquired before connect', async () => {
    const handler = jest.fn()
    connection.on('connected', handler)

    amqpConnection.simulate('acquired')
    await tick()
    expect(handler).toHaveBeenCalled()
  })

  it('should emit connected after connection is acquired', async () => {
    const handler = jest.fn()
    connection.on('connected', handler)

    connection.connect()
    amqpConnection.simulate('acquired')
    await tick()
    expect(handler).toHaveBeenCalled()
  })

  it('should emit failed when connection fails before connect', async () => {
    const handler = jest.fn()
    connection.on('failed', handler)

    amqpConnection.simulate('failed')
    await tick()
    expect(handler).toHaveBeenCalled()
  })

  it('should emit failed when connection fails before connection', async () => {
    const handler = jest.fn()
    connection.on('failed', handler)

    connection.connect()
    amqpConnection.simulate('failed')
    await tick()
    expect(handler).toHaveBeenCalled()
  })

  it('should emit failed when connection fails during connection', async () => {
    const handler = jest.fn()
    connection.on('failed', handler)

    connection.connect()
    amqpConnection.simulate('acquiring')
    amqpConnection.simulate('failed')
    await tick()
    expect(handler).toHaveBeenCalled()
  })

  it('should emit failed when connection fails after connection', async () => {
    const handler = jest.fn()
    connection.on('failed', handler)

    connection.connect()
    amqpConnection.simulate('acquired')
    amqpConnection.simulate('failed')
    await tick()
    expect(handler).toHaveBeenCalled()
  })
})
