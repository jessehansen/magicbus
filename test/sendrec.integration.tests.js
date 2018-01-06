const magicbus = require('../lib')
const environment = require('./_test-env')

describe('Send/Receive integration', () => {
  let serviceDomainName = 'magicbus'
  let appName = 'tests'
  let connectionInfo = environment.rabbit
  let broker
  let sender
  let receiver

  beforeAll(() => {
    broker = magicbus.createBroker(serviceDomainName, appName, connectionInfo)
    sender = magicbus.createPublisher(broker, (cfg) => cfg.useRouteName('publish'))
    receiver = magicbus.createConsumer(broker, (cfg) => cfg.useRouteName('subscribe'))

    return broker.bind(sender.getRoute().name, receiver.getRoute().name, { pattern: '#' })
      .then(() => {
        return receiver.purgeQueue()
      })
  })

  afterAll(() => {
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
})
