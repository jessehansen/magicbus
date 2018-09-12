const DefaultConsumerTopology = require('../lib/consumer/default-consumer-topology')

describe('DefaultConsumerTopology', () => {
  const serviceDomainName = 'magicbus'
  const appName = 'tests'
  const routeName = 'default-topology'
  const noAck = false
  const durable = true
  const autoDelete = false
  const exclusive = false
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

    filter = DefaultConsumerTopology({
      serviceDomainName,
      appName,
      routeName,
      noAck,
      durable,
      autoDelete,
      exclusive,
      failureQueue,
      topology: mockTopology
    })
  })

  it('should set context.queue to the appropriate name', async () => {
    await filter(context, next)

    expect(context.queue).toEqual(`${serviceDomainName}.${appName}.${routeName}`)
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
      exclusive
    }))
  })

  it('should set context.failureQueue to the appropriate name', async () => {
    await filter(context, next)

    expect(context.failedQueue).toEqual(`${serviceDomainName}.${appName}.${routeName}.failed`)
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

  it('should create a failure queue with the correct options', async () => {
    await filter(context, next)

    expect(mockTopology.createQueue).toHaveBeenCalledWith(expect.objectContaining({ name: context.queue }))
    expect(mockTopology.createQueue).toHaveBeenCalledWith(expect.objectContaining({
      name: context.failedQueue,
      noAck,
      durable,
      autoDelete,
      exclusive
    }))
  })

  it('should support having no failure queue', async () => {
    filter = DefaultConsumerTopology({
      serviceDomainName,
      appName,
      routeName,
      noAck,
      durable,
      autoDelete,
      exclusive,
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
      exclusive
    }))
    expect(context.failedQueue).toBeUndefined()
  })

  it('should support inspect', async () => {
    expect(filter.inspect()).toEqual(expect.objectContaining({
      type: 'Default Consumer Topology',
      serviceDomainName,
      appName,
      routeName,
      noAck,
      durable,
      autoDelete,
      exclusive,
      failureQueue
    }))
  })
})
