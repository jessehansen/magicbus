const magicbus = require('../lib')
const environment = require('./_test-env')

describe('Send/Receive integration', () => {
  let serviceDomainName = 'magicbus'
  let appName = 'tests'
  let connectionInfo = environment.rabbit
  let broker
  let sender
  let receiver

  beforeEach(() => {
    broker = magicbus.createBroker(serviceDomainName, appName, connectionInfo)
    sender = magicbus.createPublisher(broker, (cfg) => {
      cfg.useRoutePattern(magicbus.routePatterns.publisher({ autoDelete: true, durable: false }))
      cfg.useRouteName('send')
    })
    receiver = magicbus.createConsumer(broker, (cfg) => {
      cfg.useRoutePattern(magicbus.routePatterns.worker({ autoDelete: true, durable: false, exclusive: true }))
      cfg.useRouteName('receive')
    })

    return broker.bind(sender.getRoute().name, receiver.getRoute().name, { pattern: '#' })
      .then(() => {
        return receiver.purgeQueue()
      })
  })

  afterEach(() => {
    return broker.shutdown()
  })

  it('should be able to send a message and receive that message', (done) => {
    let message = {
      fooId: 123
    }
    let messageType = 'deactivateFooCommand'

    let handler = function (handlerMessage, handlerMessageTypes) {
      expect(handlerMessage).toEqual(message)
      expect(handlerMessageTypes).toEqual([messageType])

      done()
    }

    receiver.startConsuming(handler).then(() => {
      sender.send(message, messageType)
    })
  })

  it('should support nacking a message that cannot be consumed by this consumer', (done) => {
    let message = {
      fooId: 123
    }
    let messageType = 'deactivateFooCommand'

    let first = true
    let handler = function (handlerMessage, handlerMessageTypes, _, actions) {
      if (first) {
        actions.nack()
        first = false
        return
      }
      // should be processed again
      expect(handlerMessage).toEqual(message)
      expect(handlerMessageTypes).toEqual([messageType])

      done()
    }

    receiver.startConsuming(handler).then(() => {
      sender.send(message, messageType)
    })
  })
})
