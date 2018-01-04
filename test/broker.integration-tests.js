
let magicbus = require('../lib')
let environment = require('./_test-env')

let chai = require('chai')
let expect = chai.expect

let PublisherRoutePattern = require('../lib/route-patterns/publisher-route-pattern')
let WorkerRoutePattern = require('../lib/route-patterns/worker-route-pattern')

function noOp () { }

describe('Broker really using RabbitMQ', function () {
  let serviceDomainName = 'magicbus'
  let appName = 'tests'
  let connectionInfo = environment.rabbit
  let broker
  let bound

  beforeEach(function () {
    let p
    broker = magicbus.createBroker(serviceDomainName, appName, connectionInfo)

    broker.registerRoute('publish', new PublisherRoutePattern())
    broker.registerRoute('subscribe', new WorkerRoutePattern())

    p = Promise.resolve()
    if (!bound) {
      p = p.then(function () {
        broker.bind('publish', 'subscribe', { pattern: '#' })
        bound = true
      })
    }
    return p.then(function () {
      return broker.purgeRouteQueue('subscribe')
    })
  })

  afterEach(function () {
    return broker.shutdown()
      .then(function () {
        broker = null
      })
  })

  describe('lifetime management', function () {
    it('should be able to shutdown many times without problems', function () {
      broker.shutdown()
      return broker.shutdown()
    })
    it('should not allow publish after shutdown', function () {
      let caught = false
      return broker.shutdown()
        .then(() => broker.publish('publish', { routingKey: 'fail', payload: Buffer.from('dead') }))
        .catch(() => {
          caught = true
        })
        .then(() => {
          expect(caught).to.equal(true)
        })
    })
    it('should not allow consume after shutdown', function () {
      let caught = false
      return broker.shutdown()
        .then(() => broker.consume('subscribe', noOp))
        .catch(() => {
          caught = true
        })
        .then(() => {
          expect(caught).to.equal(true)
        })
    })
  })

  describe('with consumption defaults', function () {
    it('should be able to publish and consume messages', function (done) {
      let theMessage = 'Can I buy your magic bus?'

      let handler = function (msg, ops) {
        let messageContent = Buffer.from(msg.content).toString()
        expect(messageContent).to.eq(theMessage)

        ops.ack()
        done()
      }

      broker.consume('subscribe', handler).then(function () {
        broker.publish('publish', { routingKey: 'succeed', payload: Buffer.from(theMessage) })
      })
    })

    it('should be able to reject messages and have them end up in a failed queue', function (done) {
      let theMessage = 'Can I buy your magic bus?'

      let handler = function (msg, ops) {
        ops.reject()
        done()
      }

      broker.consume('subscribe', handler).then(function () {
        broker.publish('publish', { routingKey: 'fail', payload: Buffer.from(theMessage) })
      })
    })

    it('should be able to nack messages and have them redelivered', function (done) {
      let theMessage = 'Can I buy your magic bus?'
      let count = 0

      let handler = function (msg, ops) {
        if (count++ === 1) {
          ops.nack()
        } else {
          ops.ack()
          done()
        }
      }

      broker.consume('subscribe', handler).then(function () {
        broker.publish('publish', { routingKey: 'fail', payload: Buffer.from(theMessage) })
      })
    })

    it('should be able to ack and nack multiple messages and have them be batched', function (done) {
      let messageCount = 0, targetCount = 10

      let handler = function (msg, ops) {
        let messageContent = parseInt(Buffer.from(msg.content).toString(), 10)
        messageCount++
        if (messageContent > 3 && messageContent < 7) {
          ops.ack()
        } else {
          ops.reject()
        }
        if (messageCount === targetCount) {
          done()
          // right now, I'm manually verifying that the subscribe queue is empty after broker shutdown
        }
      }

      broker.consume('subscribe', handler).then(function () {
        let i
        for (i = 0; i < targetCount; i++) {
          broker.publish('publish', { routingKey: 'fail', payload: Buffer.from(String(i)) })
        }
      })
    })
  })

  describe('with noBatch specified', function () {
    it('should be able to publish and consume messages', function (done) {
      let theMessage = 'Can I buy your magic bus?'

      let handler = function (msg, ops) {
        let messageContent = Buffer.from(msg.content).toString()
        expect(messageContent).to.eq(theMessage)

        ops.ack()
        done()
      }

      broker.consume('subscribe', handler, { noBatch: true, limit: 10 }).then(function () {
        broker.publish('publish', { routingKey: 'succeed', payload: Buffer.from(theMessage) })
      })
    })

    it('should be able to ack, reject, and nack messages', function (done) {
      let messageCount = 0, targetCount = 10

      let handler = function (msg, ops) {
        let messageContent = parseInt(Buffer.from(msg.content).toString(), 10)
        messageCount++
        if (messageContent > 3 && messageContent < 7) {
          ops.ack()
        } else if (messageContent < 7) {
          ops.reject()
        } else if (messageCount === targetCount) {
          ops.nack()
        } else {
          ops.ack()
        }
        if (messageCount === targetCount + 1) {
          done()
          // right now, I'm manually verifying that the subscribe queue is empty after broker shutdown
        }
      }

      broker.consume('subscribe', handler, { noBatch: true, limit: 10 }).then(function () {
        let i
        for (i = 0; i < targetCount; i++) {
          broker.publish('publish', { routingKey: 'fail', payload: Buffer.from(String(i)) })
        }
      })
    })
  })

  describe('with noAck specified', function () {
    it('should be able to publish and consume messages', function (done) {
      let theMessage = 'Can I buy your magic bus?'

      let handler = function (msg, ops) {
        let messageContent = Buffer.from(msg.content).toString()
        expect(messageContent).to.eq(theMessage)

        ops.ack()
        done()
      }

      broker.consume('subscribe', handler, { noAck: true }).then(function () {
        broker.publish('publish', { routingKey: 'succeed', payload: Buffer.from(theMessage) })
      })
    })

    it('should be able to ack, reject, and nack messages', function (done) {
      let messageCount = 0, targetCount = 10

      let handler = function (msg, ops) {
        let messageContent = parseInt(Buffer.from(msg.content).toString(), 10)
        messageCount++
        if (messageContent > 3 && messageContent < 7) {
          ops.ack()
        } else if (messageContent < 7) {
          ops.reject()
        } else {
          ops.nack()
        }
        if (messageCount === targetCount) {
          done()
        }
      }

      broker.consume('subscribe', handler, { noAck: true }).then(function () {
        let i
        for (i = 0; i < targetCount; i++) {
          broker.publish('publish', { routingKey: 'fail', payload: Buffer.from(String(i)) })
        }
      })
    })
  })

  describe('with noAck and noBatch specified', function () {
    it('should be able to publish and consume messages', function (done) {
      let theMessage = 'Can I buy your magic bus?'

      let handler = function (msg) {
        let messageContent = Buffer.from(msg.content).toString()
        expect(messageContent).to.eq(theMessage)

        done()
      }

      broker.consume('subscribe', handler, { noAck: true, noBatch: true, limit: 10 }).then(function () {
        broker.publish('publish', { routingKey: 'succeed', payload: Buffer.from(theMessage) })
      })
    })

    it('should be able to receive multiple messages', function (done) {
      let messageCount = 0, targetCount = 10

      let handler = function () {
        messageCount++
        if (messageCount === targetCount) {
          done()
        }
      }

      broker.consume('subscribe', handler, { noAck: true, noBatch: true, limit: 10 }).then(function () {
        let i
        for (i = 0; i < targetCount; i++) {
          broker.publish('publish', { routingKey: 'fail', payload: Buffer.from(String(i)) })
        }
      })
    })
  })
})
