const magicbus = require('../lib')
const environment = require('./_test-env')

describe('Send/Receive integration', function () {
  let serviceDomainName = 'magicbus'
  let appName = 'tests'
  let connectionInfo = environment.rabbit
  let broker
  let sender
  let receiver

  beforeAll(function () {
    broker = magicbus.createBroker(serviceDomainName, appName, connectionInfo)
    sender = magicbus.createPublisher(broker, function (cfg) {
      cfg.useRouteName('publish')
    })
    receiver = magicbus.createConsumer(broker, function (cfg) {
      cfg.useRouteName('subscribe')
    })

    return broker.bind(sender.getRoute().name, receiver.getRoute().name, { pattern: '#' })
      .then(function () {
        return receiver.purgeQueue()
      })
  })

  afterAll(function () {
    return broker.shutdown()
  })

  it('should be able to send a message and receive that message', function (done) {
    let message = {
      fooId: 123
    }
    let messageType = 'deactivateFooCommand'

    let handler = function (handlerMessage, handlerMessageTypes) {
      expect(handlerMessage).toEqual(message)
      expect(handlerMessageTypes).toEqual([messageType])

      done()
    }

    receiver.startConsuming(handler).then(function () {
      sender.send(message, messageType)
    })
  })
})
