
let WorkerRoutePattern = require('../../lib/route-patterns/worker-route-pattern.js')

let Promise = require('bluebird')

let chai = require('chai')
let expect = chai.expect

let sinon = require('sinon')
let sinonChai = require('sinon-chai')
chai.use(sinonChai)

chai.use(require('chai-as-promised'))

describe('WorkerRoutePattern', function () {
  describe('createTopology', function () {
    let mockTopology
    let routePattern

    beforeEach(function () {
      mockTopology = {
        createExchange: function () {
          return Promise.resolve()
        },
        createQueue: function () {
          return Promise.resolve()
        },
        createBinding: function () {
          return Promise.resolve()
        }
      }

      routePattern = new WorkerRoutePattern()
    })

    it('should assert a dead letter exchange', function () {
      sinon.spy(mockTopology, 'createExchange')

      return routePattern.createTopology(mockTopology, 'my-domain', 'my-app', 'my-route').then(function () {
        expect(mockTopology.createExchange).to.have.been.calledWith({
          name: 'my-domain.my-app.my-route.failed',
          type: 'fanout',
          durable: true
        })
      })
    })

    it('should assert a queue to hold failed messages', function () {
      sinon.spy(mockTopology, 'createQueue')

      return routePattern.createTopology(mockTopology, 'my-domain', 'my-app', 'my-route').then(function () {
        expect(mockTopology.createQueue).to.have.been.calledWith({
          name: 'my-domain.my-app.my-route.failed'
        })
      })
    })

    it('should bind the failed message queue to the dead letter exchange', function () {
      sinon.spy(mockTopology, 'createBinding')

      return routePattern.createTopology(mockTopology, 'my-domain', 'my-app', 'my-route').then(function () {
        expect(mockTopology.createBinding).to.have.been.calledWith({
          source: 'my-domain.my-app.my-route.failed',
          target: 'my-domain.my-app.my-route.failed'
        })
      })
    })

    it('should assert the queue to consume from and connect it to the dead letter exchange', function () {
      sinon.spy(mockTopology, 'createQueue')

      return routePattern.createTopology(mockTopology, 'my-domain', 'my-app', 'my-route').then(function () {
        expect(mockTopology.createQueue).to.have.been.calledWith(sinon.match({
          name: 'my-domain.my-app.my-route',
          deadLetter: 'my-domain.my-app.my-route.failed'
        }))
      })
    })

    it('should return the name of the queue to consume from', function () {
      let p = routePattern.createTopology(mockTopology, 'my-domain', 'my-app', 'my-route')

      return expect(p).to.eventually.eql({ queueName: 'my-domain.my-app.my-route' })
    })

    it('should reject if any of the topology cannot be created', function () {
      mockTopology.createQueue = function () {
        return Promise.reject(new Error('Nuts!'))
      }

      return expect(routePattern.createTopology(mockTopology, 'my-domain', 'my-app', 'my-route')).to.be.rejectedWith('Nuts!')
    })
  })
})
