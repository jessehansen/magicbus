const publisherRoutePattern = require('../../lib/route-patterns/publisher-route-pattern.js')

describe('PublisherRoutePattern', () => {
  let mockTopology
  let routePattern

  beforeEach(() => {
    mockTopology = {
      createExchange: jest.fn(() => {
        return Promise.resolve()
      })
    }

    routePattern = publisherRoutePattern()
  })

  it('should assert an exchange', async () => {
    await routePattern(mockTopology, 'my-domain', 'my-app', 'my-route')
    expect(mockTopology.createExchange).toHaveBeenCalledWith({
      name: 'my-domain.my-app.my-route',
      type: 'topic',
      durable: true,
      autoDelete: false
    })
  })

  it('should pass options to the createExchange call', async () => {
    routePattern = publisherRoutePattern({
      exchangeType: 'headers',
      durable: false,
      autoDelete: true
    })
    await routePattern(mockTopology, 'my-domain', 'my-app', 'my-route')
    expect(mockTopology.createExchange).toHaveBeenCalledWith({
      name: 'my-domain.my-app.my-route',
      type: 'headers',
      durable: false,
      autoDelete: true
    })
  })

  it('should return the name of the exchange it created', () => {
    return expect(routePattern(mockTopology, 'my-domain', 'my-app', 'my-route')).resolves.toEqual({ exchangeName: 'my-domain.my-app.my-route' })
  })

  it('should reject if the exchange cannot be created', () => {
    mockTopology.createExchange = () => {
      return Promise.reject(new Error('Shoot!'))
    }

    return expect(routePattern(mockTopology, 'my-domain', 'my-app', 'my-route')).rejects.toThrow('Shoot!')
  })
})
