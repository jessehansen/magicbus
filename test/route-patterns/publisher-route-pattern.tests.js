const publisherRoutePattern = require('../../lib/route-patterns/publisher-route-pattern.js')

const Promise = require('bluebird')

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

  it('should assert an exchange with a conventional name and the specified type', async () => {
    await routePattern(mockTopology, 'my-domain', 'my-app', 'my-route')
    expect(mockTopology.createExchange).toHaveBeenCalledWith({
      name: 'my-domain.my-app.my-route',
      type: 'topic',
      durable: true
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

  describe('given an exchangeType', () => {
    it('should use the exchange type passed in the options', async () => {
      let routePattern = publisherRoutePattern({ exchangeType: 'headers' })
      await routePattern(mockTopology, 'my-domain', 'my-app', 'my-route')
      expect(mockTopology.createExchange).toHaveBeenCalledWith({
        name: 'my-domain.my-app.my-route',
        type: 'headers',
        durable: true
      })
    })
  })
})
