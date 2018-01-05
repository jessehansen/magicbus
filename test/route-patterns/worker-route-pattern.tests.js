const workerRoutePattern = require('../../lib/route-patterns/worker-route-pattern.js')

const Promise = require('bluebird')

describe('WorkerRoutePattern', function () {
  let mockTopology
  let routePattern

  beforeEach(function () {
    mockTopology = {
      createExchange: jest.fn(function () {
        return Promise.resolve()
      }),
      createQueue: jest.fn(function () {
        return Promise.resolve()
      }),
      createBinding: jest.fn(function () {
        return Promise.resolve()
      })
    }

    routePattern = workerRoutePattern()
  })

  it('should assert a dead letter exchange', function () {
    return routePattern(mockTopology, 'my-domain', 'my-app', 'my-route').then(function () {
      expect(mockTopology.createExchange).toHaveBeenCalledWith({
        name: 'my-domain.my-app.my-route.failed',
        type: 'fanout',
        durable: true
      })
    })
  })

  it('should assert a queue to hold failed messages', function () {
    return routePattern(mockTopology, 'my-domain', 'my-app', 'my-route').then(function () {
      expect(mockTopology.createQueue).toHaveBeenCalledWith({
        name: 'my-domain.my-app.my-route.failed'
      })
    })
  })

  it('should bind the failed message queue to the dead letter exchange', function () {
    return routePattern(mockTopology, 'my-domain', 'my-app', 'my-route').then(function () {
      expect(mockTopology.createBinding).toHaveBeenCalledWith({
        source: 'my-domain.my-app.my-route.failed',
        target: 'my-domain.my-app.my-route.failed'
      })
    })
  })

  it('should assert the queue to consume from and connect it to the dead letter exchange', function () {
    return routePattern(mockTopology, 'my-domain', 'my-app', 'my-route').then(function () {
      expect(mockTopology.createQueue).toHaveBeenCalledWith({
        name: 'my-domain.my-app.my-route',
        deadLetter: 'my-domain.my-app.my-route.failed'
      })
    })
  })

  it('should return the name of the queue to consume from', function () {
    let p = routePattern(mockTopology, 'my-domain', 'my-app', 'my-route')

    return expect(p).resolves.toEqual({ queueName: 'my-domain.my-app.my-route' })
  })

  it('should reject if any of the topology cannot be created', function () {
    mockTopology.createQueue = function () {
      return Promise.reject(new Error('Nuts!'))
    }

    return expect(routePattern(mockTopology, 'my-domain', 'my-app', 'my-route')).rejects.toThrow('Nuts!')
  })
})
