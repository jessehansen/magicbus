const magicbus = require('../lib')
const environment = require('./_test-env')

const noOp = () => {}

describe('Broker really using RabbitMQ', () => {
  const exchangeName = 'magicbus.tests.broker-publish'
  const queueName = 'magicbus.tests.broker-subscribe'

  let serviceDomainName = 'magicbus'
  let appName = 'tests'
  let connectionInfo = environment.rabbit
  let broker

  beforeAll(() => {
    // magicbus.on('log', ({ kind, namespace, message, err }) =>
    //   err
    //     ? console.log(namespace, kind, message, err)
    //     : console.log(namespace, kind, message))
  })

  beforeEach(async () => {
    broker = magicbus.createBroker(serviceDomainName, appName, connectionInfo)
    let topology = broker.getTopologyParams().topology

    // TODO: This is a bit awkward, but maybe we just should remove these integration tests
    await topology.createExchange({ name: exchangeName, type: 'topic', autoDelete: true, durable: false })
    await topology.createQueue({ name: queueName, autoDelete: true, durable: false, exclusive: true })

    await broker.bind(exchangeName, queueName, { pattern: '#' })
    await broker.purgeQueue(queueName)
  })

  afterEach(async () => {
    await broker.shutdown()
    broker = null
  })

  describe('lifetime management', () => {
    it('should be able to shutdown many times without problems', () => {
      broker.shutdown()
      return broker.shutdown()
    })
    it('should not allow publish after shutdown', () => {
      let caught = false
      return broker.shutdown()
        .then(() => broker.publish({ exchange: exchangeName, routingKey: 'fail', content: Buffer.from('dead') }))
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
        .then(() => broker.consume({ queue: queueName }, noOp))
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

      let handler = (ctx, ops) => {
        let messageContent = Buffer.from(ctx.content).toString()
        expect(messageContent).toEqual(theMessage)

        ops.ack()
        done()
      }

      broker.consume({ queue: queueName }, handler).then(() => {
        broker.publish({ exchange: exchangeName, routingKey: 'succeed', content: Buffer.from(theMessage) })
      })
    })

    it('should be able to reject messages and have them end up in a failed queue', (done) => {
      let theMessage = 'Can I buy your magic bus?'

      let handler = (msg, ops) => {
        ops.reject()
        done()
      }

      broker.consume({ queue: queueName }, handler).then(() => {
        broker.publish({ exchange: exchangeName, routingKey: 'fail', content: Buffer.from(theMessage) })
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

      broker.consume({ queue: queueName }, handler).then(() => {
        broker.publish({ exchange: exchangeName, routingKey: 'fail', content: Buffer.from(theMessage) })
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

      broker.consume({ queue: queueName }, handler).then(() => {
        let i
        for (i = 0; i < targetCount; i++) {
          broker.publish({ exchange: exchangeName, routingKey: 'fail', content: Buffer.from(String(i)) })
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

      broker.consume({ queue: queueName, options: { noBatch: true, limit: 10 } }, handler).then(() => {
        broker.publish({ exchange: exchangeName, routingKey: 'succeed', content: Buffer.from(theMessage) })
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

      broker.consume({ queue: queueName, options: { noBatch: true, limit: 10 } }, handler).then(() => {
        let i
        for (i = 0; i < targetCount; i++) {
          broker.publish({ exchange: exchangeName, routingKey: 'fail', content: Buffer.from(String(i)) })
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

      broker.consume({ queue: queueName, options: { noAck: true } }, handler).then(() => {
        broker.publish({ exchange: exchangeName, routingKey: 'succeed', content: Buffer.from(theMessage) })
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

      broker.consume({ queue: queueName, options: { noAck: true } }, handler).then(() => {
        let i
        for (i = 0; i < targetCount; i++) {
          broker.publish({ exchange: exchangeName, routingKey: 'fail', content: Buffer.from(String(i)) })
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

      broker.consume({ queue: queueName, options: { noAck: true, noBatch: true, limit: 10 } }, handler).then(() => {
        broker.publish({ exchange: exchangeName, routingKey: 'succeed', content: Buffer.from(theMessage) })
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

      broker.consume({ queue: queueName, options: { noAck: true, noBatch: true, limit: 10 } }, handler).then(() => {
        let i
        for (i = 0; i < targetCount; i++) {
          broker.publish({ exchange: exchangeName, routingKey: 'fail', content: Buffer.from(String(i)) })
        }
      })
    })
  })
})
