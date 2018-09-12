const DefaultPublisherTopology = require('../lib/publisher/default-publisher-topology')

describe('DefaultPublisherTopology', () => {
  const serviceDomainName = 'magicbus'
  const appName = 'tests'
  const routeName = 'default-topology'
  const exchangeType = 'topic'
  const durable = true
  const autoDelete = false
  const next = () => Promise.resolve
  let mockTopology
  let context
  let filter
  beforeEach(() => {
    mockTopology = {
      createExchange: jest.fn(() => Promise.resolve())
    }

    context = {}

    filter = DefaultPublisherTopology({
      serviceDomainName,
      appName,
      routeName,
      exchangeType,
      durable,
      autoDelete,
      topology: mockTopology
    })
  })

  it('should set context.exchange to the appropriate name', async () => {
    await filter(context, next)

    expect(context.exchange).toEqual(`${serviceDomainName}.${appName}.${routeName}`)
  })

  it('should create an exchange using topology', async () => {
    await filter(context, next)

    expect(mockTopology.createExchange).toHaveBeenCalledWith(expect.objectContaining({ name: context.exchange }))
  })

  it('should create an exchange with the correct options', async () => {
    await filter(context, next)

    expect(mockTopology.createExchange).toHaveBeenCalledWith(expect.objectContaining({
      type: exchangeType,
      durable,
      autoDelete
    }))
  })

  it('should support inspect', async () => {
    expect(filter.inspect()).toEqual(expect.objectContaining({
      type: 'Default Publisher Topology',
      serviceDomainName,
      appName,
      routeName,
      exchangeType,
      durable,
      autoDelete
    }))
  })
})
