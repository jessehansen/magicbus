const listenerRoutePattern = require('../../lib/route-patterns/listener-route-pattern.js')
const Promise = require('bluebird')

describe('listenerRoutePattern', () => {
  let mockTopology
  let routePattern

  beforeEach(() => {
    mockTopology = {
      createQueue: jest.fn(() => {
        return Promise.resolve()
      }),
      createExchange: jest.fn(() => {
        return Promise.resolve()
      }),
      createBinding: jest.fn(() => {
        return Promise.resolve()
      })
    }

    routePattern = listenerRoutePattern()
  })

  it('should create a fanout exchange with a conventional name', () => {
    return routePattern(mockTopology, 'my-domain', 'my-app', 'my-route').then(() => {
      expect(mockTopology.createExchange).toHaveBeenCalledWith({
        name: 'my-domain.my-app.my-route',
        type: 'fanout',
        durable: true,
        autoDelete: false
      })
    })
  })

  it('should use passed options for exchange', () => {
    routePattern = listenerRoutePattern({ durable: false, autoDelete: true })

    return routePattern(mockTopology, 'my-domain', 'my-app', 'my-route').then(() => {
      expect(mockTopology.createExchange).toHaveBeenCalledWith({
        name: 'my-domain.my-app.my-route',
        type: 'fanout',
        durable: false,
        autoDelete: true
      })
    })
  })

  it('should use passed options for queue', () => {
    routePattern = listenerRoutePattern({ noAck: true })

    return routePattern(mockTopology, 'my-domain', 'my-app', 'my-route').then(() => {
      expect(mockTopology.createQueue).toHaveBeenCalledWith(expect.objectContaining({
        name: expect.stringMatching(/my-domain.my-app.my-route.listener-\.*/),
        exclusive: true,
        durable: false,
        noAck: true
      }))
    })
  })

  it('should create an exclusive temporary queue with a random name', () => {
    return routePattern(mockTopology, 'my-domain', 'my-app', 'my-route').then(() => {
      expect(mockTopology.createQueue).toHaveBeenCalledWith(expect.objectContaining({
        name: expect.stringMatching(/my-domain.my-app.my-route.listener-\.*/),
        exclusive: true,
        durable: false
      }))
    })
  })

  it('should bind the temporary queue to the fanout exchange', () => {
    return routePattern(mockTopology, 'my-domain', 'my-app', 'my-route').then(() => {
      expect(mockTopology.createBinding).toHaveBeenCalledWith(expect.objectContaining({
        target: expect.stringMatching(/my-domain.my-app.my-route.listener-\.*/),
        source: 'my-domain.my-app.my-route'
      }))
    })
  })

  it('should return the name of the queue to consume from', () => {
    let p = routePattern(mockTopology, 'my-domain', 'my-app', 'my-route')

    return expect(p).resolves.toEqual(expect.objectContaining({
      queueName: expect.stringMatching(/my-domain.my-app.my-route.listener-\.*/)
    }))
  })

  it('should reject if any of the topology cannot be created', () => {
    mockTopology.createQueue = () => {
      return Promise.reject(new Error('Nuts!'))
    }

    return expect(routePattern(mockTopology, 'my-domain', 'my-app', 'my-route')).rejects.toThrow('Nuts!')
  })
})
