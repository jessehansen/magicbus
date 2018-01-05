const listenerRoutePattern = require('../../lib/route-patterns/listener-route-pattern.js')
const Promise = require('bluebird')

describe('listenerRoutePattern', function () {
  let mockTopology
  let routePattern

  beforeEach(function () {
    mockTopology = {
      createQueue: jest.fn(function () {
        return Promise.resolve()
      }),
      createExchange: jest.fn(function () {
        return Promise.resolve()
      }),
      createBinding: jest.fn(function () {
        return Promise.resolve()
      })
    }

    routePattern = listenerRoutePattern()
  })

  it('should create a fanout exchange with a conventional name', function () {
    return routePattern(mockTopology, 'my-domain', 'my-app', 'my-route').then(function () {
      expect(mockTopology.createExchange).toHaveBeenCalledWith({
        name: 'my-domain.my-app.my-route',
        type: 'fanout',
        durable: true
      })
    })
  })

  it('should create an exclusive temporary queue with a random name', function () {
    return routePattern(mockTopology, 'my-domain', 'my-app', 'my-route').then(function () {
      expect(mockTopology.createQueue).toHaveBeenCalledWith(expect.objectContaining({
        name: expect.stringMatching(/my-domain.my-app.my-route.listener-\.*/),
        exclusive: true,
        durable: false
      }))
    })
  })

  it('should bind the temporary queue to the fanout exchange', function () {
    return routePattern(mockTopology, 'my-domain', 'my-app', 'my-route').then(function () {
      expect(mockTopology.createBinding).toHaveBeenCalledWith(expect.objectContaining({
        target: expect.stringMatching(/my-domain.my-app.my-route.listener-\.*/),
        source: 'my-domain.my-app.my-route'
      }))
    })
  })

  it('should return the name of the queue to consume from', function () {
    let p = routePattern(mockTopology, 'my-domain', 'my-app', 'my-route')

    return expect(p).resolves.toEqual(expect.objectContaining({
      queueName: expect.stringMatching(/my-domain.my-app.my-route.listener-\.*/)
    }))
  })

  it('should reject if any of the topology cannot be created', function () {
    mockTopology.createQueue = function () {
      return Promise.reject(new Error('Nuts!'))
    }

    return expect(routePattern(mockTopology, 'my-domain', 'my-app', 'my-route')).rejects.toThrow('Nuts!')
  })
})
