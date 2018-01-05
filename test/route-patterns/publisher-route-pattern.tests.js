const PublisherRoutePattern = require('../../lib/route-patterns/publisher-route-pattern.js')

const Promise = require('bluebird')

describe('PublisherRoutePattern', function () {
  describe('default construction', function () {
    let routePattern

    beforeEach(function () {
      routePattern = new PublisherRoutePattern()
    })

    it('should use the topic exchange type', function () {
      expect(routePattern.exchangeType).toEqual('topic')
    })
  })

  describe('construction options', function () {
    it('should use the exchange type passed in the options', function () {
      let routePattern = new PublisherRoutePattern({
        exchangeType: 'headers'
      })

      expect(routePattern.exchangeType).toEqual('headers')
    })
  })

  describe('createTopology', function () {
    let mockTopology
    let routePattern

    beforeEach(function () {
      mockTopology = {
        createExchange: jest.fn(function () {
          return Promise.resolve()
        })
      }

      routePattern = new PublisherRoutePattern()
    })

    it('should assert an exchange with a conventional name and the specified type', function () {
      return routePattern.createTopology(mockTopology, 'my-domain', 'my-app', 'my-route').then(function () {
        expect(mockTopology.createExchange).toHaveBeenCalledWith({
          name: 'my-domain.my-app.my-route',
          type: routePattern.exchangeType,
          durable: true
        })
      })
    })

    it('should return the name of the exchange it created', function () {
      let p = routePattern.createTopology(mockTopology, 'my-domain', 'my-app', 'my-route')

      return expect(p).resolves.toEqual({ exchangeName: 'my-domain.my-app.my-route' })
    })

    it('should reject if the exchange cannot be created', function () {
      mockTopology.createExchange = function () {
        return Promise.reject(new Error('Shoot!'))
      }

      return expect(routePattern.createTopology(mockTopology, 'my-domain', 'my-app', 'my-route')).rejects.toThrow('Shoot!')
    })
  })
})
