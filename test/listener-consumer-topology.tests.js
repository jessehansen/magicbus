const ListenerConsumerTopology = require('../lib/consumer/listener-consumer-topology')

describe('ListenerConsumerTopology', () => {
  const serviceDomainName = 'magicbus'
  const appName = 'tests'
  const routeName = 'default-topology'
  const noAck = false
  const durable = true
  const autoDelete = false
  const failureQueueExclusive = false
  const failureQueue = true
  const next = () => Promise.resolve
  let mockTopology
  let context
  let filter
  beforeEach(() => {
    mockTopology = {
      createExchange: jest.fn(() => Promise.resolve()),
      createQueue: jest.fn(() => Promise.resolve()),
      createBinding: jest.fn(() => Promise.resolve())
    }

    context = {}

    filter = ListenerConsumerTopology({
      serviceDomainName,
      appName,
      routeName,
      noAck,
      durable,
      autoDelete,
      failureQueue,
      failureQueueExclusive,
      topology: mockTopology
    })
  })

  it('should set context.queue to the appropriate name', async () => {
    await filter(context, next)

    expect(context.queue).toEqual(
      expect.stringMatching(new RegExp(`^${serviceDomainName}\\.${appName}\\.${routeName}\\.listener-[a-zA-Z0-9_-]+`)))
  })

  it('should set context.exchange to the appropriate name', async () => {
    await filter(context, next)

    expect(context.exchange).toEqual(`${serviceDomainName}.${appName}.${routeName}`)
  })

  it('should create a queue using topology', async () => {
    await filter(context, next)

    expect(mockTopology.createQueue).toHaveBeenCalledWith(expect.objectContaining({ name: context.queue }))
  })

  it('should create a queue with the correct options', async () => {
    await filter(context, next)

    expect(mockTopology.createQueue).toHaveBeenCalledWith(expect.objectContaining({
      noAck,
      durable,
      autoDelete,
      exclusive: true
    }))
  })

  it('should create an exchange using topology', async () => {
    await filter(context, next)

    expect(mockTopology.createExchange).toHaveBeenCalledWith({
      name: context.exchange,
      type: 'fanout',
      durable,
      autoDelete
    })
  })

  it('should create a binding using topology', async () => {
    await filter(context, next)

    expect(mockTopology.createBinding).toHaveBeenCalledWith({
      source: context.exchange,
      target: context.queue,
      queue: true
    })
  })

  it('should set context.failureQueue to the appropriate name', async () => {
    await filter(context, next)

    expect(context.failedQueue).toEqual(`${serviceDomainName}.${appName}.${routeName}.failed`)
  })

  it('should create a failure queue with the correct options', async () => {
    await filter(context, next)

    expect(mockTopology.createQueue).toHaveBeenCalledWith(expect.objectContaining({
      name: context.failedQueue,
      durable,
      autoDelete,
      exclusive: failureQueueExclusive
    }))
  })

  it('should create an exchange for the failure queue', async () => {
    await filter(context, next)

    expect(mockTopology.createExchange).toHaveBeenCalledWith({
      name: context.failedQueue,
      type: 'fanout',
      durable,
      autoDelete
    })
  })

  it('should create a binding for the failure queue', async () => {
    await filter(context, next)

    expect(mockTopology.createBinding).toHaveBeenCalledWith({
      source: context.failedQueue,
      target: context.failedQueue,
      queue: true
    })
  })

  it('should support having no failure queue', async () => {
    filter = ListenerConsumerTopology({
      serviceDomainName,
      appName,
      routeName,
      noAck,
      durable,
      autoDelete,
      failureQueueExclusive,
      failureQueue: false,
      topology: mockTopology
    })
    await filter(context, next)
    expect(mockTopology.createQueue).toHaveBeenCalledTimes(1)
    expect(mockTopology.createQueue).toHaveBeenCalledWith(expect.objectContaining({
      name: context.queue,
      noAck,
      durable,
      autoDelete,
      exclusive: true
    }))
    expect(context.failedQueue).toBeUndefined()
  })

  it('should support inspect', async () => {
    expect(filter.inspect()).toEqual(expect.objectContaining({
      type: 'Listener Consumer Topology',
      serviceDomainName,
      appName,
      routeName,
      noAck,
      durable,
      autoDelete,
      failureQueueExclusive,
      failureQueue
    }))
  })
})
