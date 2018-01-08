const magicbus = require('../lib')
const environment = require('./_test-env')

const PublisherRoutePattern = require('../lib/route-patterns/publisher-route-pattern')
const WorkerRoutePattern = require('../lib/route-patterns/worker-route-pattern')

const noOp = () => {}

describe('Broker really using RabbitMQ', () => {
  let serviceDomainName = 'magicbus'
  let appName = 'tests'
  let connectionInfo = environment.rabbit
  let broker

  beforeEach(async () => {
    broker = magicbus.createBroker(serviceDomainName, appName, connectionInfo)

    broker.registerRoute('broker-publish', PublisherRoutePattern({ autoDelete: true, durable: false }))
    broker.registerRoute('broker-subscribe', WorkerRoutePattern({ autoDelete: true, durable: false, exclusive: true }))

    await broker.bind('broker-publish', 'broker-subscribe', { pattern: '#' })
    await broker.purgeRouteQueue('broker-subscribe')
  })

  afterEach(() => {
    return broker.shutdown()
      .then(() => {
        broker = null
      })
  })

  describe('lifetime management', () => {
    it('should be able to shutdown many times without problems', () => {
      broker.shutdown()
      return broker.shutdown()
    })
    it('should not allow publish after shutdown', () => {
      let caught = false
      return broker.shutdown()
        .then(() => broker.publish('broker-publish', { routingKey: 'fail', payload: Buffer.from('dead') }))
        .catch(() => {
          caught = true
        })
        .then(() => {
          expect(caught).toEqual(true)
        })
    })
    it('should not allow consume after shutdown', () => {
      let caught = false
      return broker.shutdown()
        .then(() => broker.consume('broker-subscribe', noOp))
        .catch(() => {
          caught = true
        })
        .then(() => {
          expect(caught).toEqual(true)
        })
    })
  })

  describe('with consumption defaults', () => {
    it('should be able to publish and consume messages', (done) => {
      let theMessage = 'Can I buy your magic bus?'

      let handler = (msg, ops) => {
        let messageContent = Buffer.from(msg.content).toString()
        expect(messageContent).toEqual(theMessage)

        ops.ack()
        done()
      }

      broker.consume('broker-subscribe', handler).then(() => {
        broker.publish('broker-publish', { routingKey: 'succeed', payload: Buffer.from(theMessage) })
      })
    })

    it('should be able to reject messages and have them end up in a failed queue', (done) => {
      let theMessage = 'Can I buy your magic bus?'

      let handler = (msg, ops) => {
        ops.reject()
        done()
      }

      broker.consume('broker-subscribe', handler).then(() => {
        broker.publish('broker-publish', { routingKey: 'fail', payload: Buffer.from(theMessage) })
      })
    })

    it('should be able to nack messages and have them redelivered', (done) => {
      let theMessage = 'Can I buy your magic bus?'
      let count = 0

      let handler = (msg, ops) => {
        if (count++ === 1) {
          ops.nack()
        } else {
          ops.ack()
          done()
        }
      }

      broker.consume('broker-subscribe', handler).then(() => {
        broker.publish('broker-publish', { routingKey: 'fail', payload: Buffer.from(theMessage) })
      })
    })

    it('should be able to ack and nack multiple messages and have them be batched', (done) => {
      let messageCount = 0, targetCount = 10

      let handler = (msg, ops) => {
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

      broker.consume('broker-subscribe', handler).then(() => {
        let i
        for (i = 0; i < targetCount; i++) {
          broker.publish('broker-publish', { routingKey: 'fail', payload: Buffer.from(String(i)) })
        }
      })
    })
  })

  describe('with noBatch specified', () => {
    it('should be able to publish and consume messages', (done) => {
      let theMessage = 'Can I buy your magic bus?'

      let handler = (msg, ops) => {
        let messageContent = Buffer.from(msg.content).toString()
        expect(messageContent).toEqual(theMessage)

        ops.ack()
        done()
      }

      broker.consume('broker-subscribe', handler, { noBatch: true, limit: 10 }).then(() => {
        broker.publish('broker-publish', { routingKey: 'succeed', payload: Buffer.from(theMessage) })
      })
    })

    it('should be able to ack, reject, and nack messages', (done) => {
      let messageCount = 0, targetCount = 10

      let handler = (msg, ops) => {
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

      broker.consume('broker-subscribe', handler, { noBatch: true, limit: 10 }).then(() => {
        let i
        for (i = 0; i < targetCount; i++) {
          broker.publish('broker-publish', { routingKey: 'fail', payload: Buffer.from(String(i)) })
        }
      })
    })
  })

  describe('with noAck specified', () => {
    it('should be able to publish and consume messages', (done) => {
      let theMessage = 'Can I buy your magic bus?'

      let handler = (msg, ops) => {
        let messageContent = Buffer.from(msg.content).toString()
        expect(messageContent).toEqual(theMessage)

        ops.ack()
        done()
      }

      broker.consume('broker-subscribe', handler, { noAck: true }).then(() => {
        broker.publish('broker-publish', { routingKey: 'succeed', payload: Buffer.from(theMessage) })
      })
    })

    it('should be able to ack, reject, and nack messages', (done) => {
      let messageCount = 0, targetCount = 10

      let handler = (msg, ops) => {
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

      broker.consume('broker-subscribe', handler, { noAck: true }).then(() => {
        let i
        for (i = 0; i < targetCount; i++) {
          broker.publish('broker-publish', { routingKey: 'fail', payload: Buffer.from(String(i)) })
        }
      })
    })
  })

  describe('with noAck and noBatch specified', () => {
    it('should be able to publish and consume messages', (done) => {
      let theMessage = 'Can I buy your magic bus?'

      let handler = function (msg) {
        let messageContent = Buffer.from(msg.content).toString()
        expect(messageContent).toEqual(theMessage)

        done()
      }

      broker.consume('broker-subscribe', handler, { noAck: true, noBatch: true, limit: 10 }).then(() => {
        broker.publish('broker-publish', { routingKey: 'succeed', payload: Buffer.from(theMessage) })
      })
    })

    it('should be able to receive multiple messages', (done) => {
      let messageCount = 0, targetCount = 10

      let handler = () => {
        messageCount++
        if (messageCount === targetCount) {
          done()
        }
      }

      broker.consume('broker-subscribe', handler, { noAck: true, noBatch: true, limit: 10 }).then(() => {
        let i
        for (i = 0; i < targetCount; i++) {
          broker.publish('broker-publish', { routingKey: 'fail', payload: Buffer.from(String(i)) })
        }
      })
    })
  })
})
