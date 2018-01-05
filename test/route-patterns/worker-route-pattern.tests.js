const workerRoutePattern = require('../../lib/route-patterns/worker-route-pattern.js')

const Promise = require('bluebird')

describe('WorkerRoutePattern', () => {
  let mockTopology
  let routePattern

  beforeEach(() => {
    mockTopology = {
      createExchange: jest.fn(() => Promise.resolve()),
      createQueue: jest.fn(() => Promise.resolve()),
      createBinding: jest.fn(() => Promise.resolve())
    }

    routePattern = workerRoutePattern()
  })

  it('should assert a dead letter exchange', () => {
    return routePattern(mockTopology, 'my-domain', 'my-app', 'my-route').then(() => {
      expect(mockTopology.createExchange).toHaveBeenCalledWith({
        name: 'my-domain.my-app.my-route.failed',
        type: 'fanout',
        durable: true
      })
    })
  })

  it('should assert a queue to hold failed messages', () => {
    return routePattern(mockTopology, 'my-domain', 'my-app', 'my-route').then(() => {
      expect(mockTopology.createQueue).toHaveBeenCalledWith({
        name: 'my-domain.my-app.my-route.failed'
      })
    })
  })

  it('should bind the failed message queue to the dead letter exchange', () => {
    return routePattern(mockTopology, 'my-domain', 'my-app', 'my-route').then(() => {
      expect(mockTopology.createBinding).toHaveBeenCalledWith({
        source: 'my-domain.my-app.my-route.failed',
        target: 'my-domain.my-app.my-route.failed'
      })
    })
  })

  it('should assert the queue to consume from and connect it to the dead letter exchange', () => {
    return routePattern(mockTopology, 'my-domain', 'my-app', 'my-route').then(() => {
      expect(mockTopology.createQueue).toHaveBeenCalledWith({
        name: 'my-domain.my-app.my-route',
        deadLetter: 'my-domain.my-app.my-route.failed',
        noAck: false
      })
    })
  })

  it('should return the name of the queue to consume from', () => {
    let p = routePattern(mockTopology, 'my-domain', 'my-app', 'my-route')

    return expect(p).resolves.toEqual({ queueName: 'my-domain.my-app.my-route' })
  })

  it('should reject if any of the topology cannot be created', () => {
    mockTopology.createQueue = () => {
      return Promise.reject(new Error('Nuts!'))
    }

    return expect(routePattern(mockTopology, 'my-domain', 'my-app', 'my-route')).rejects.toThrow('Nuts!')
  })
  describe('given options with noAck true', () => {
    it('should assert a queue with noAck', () => {
      routePattern = workerRoutePattern({ noAck: true })
      return routePattern(mockTopology, 'my-domain', 'my-app', 'my-route').then(() => {
        expect(mockTopology.createQueue).toHaveBeenCalledWith({
          name: 'my-domain.my-app.my-route',
          deadLetter: 'my-domain.my-app.my-route.failed',
          noAck: true
        })
      })
    })
  })
})
