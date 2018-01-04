
let magicbus = require('../lib')
let environment = require('./_test-env')

let chai = require('chai')
let expect = chai.expect

describe('Send/Receive integration', function () {
  let serviceDomainName = 'magicbus'
  let appName = 'tests'
  let connectionInfo = environment.rabbit
  let broker
  let sender
  let receiver

  before(function () {
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

  after(function () {
    return broker.shutdown()
  })

  it('should be able to send a message and receive that message', function (done) {
    let message = {
      fooId: 123
    }
    let messageType = 'deactivateFooCommand'

    let handler = function (handlerMessage, handlerMessageTypes) {
      expect(handlerMessage).to.eql(message)
      expect(handlerMessageTypes).to.eql([messageType])

      done()
    }

    receiver.startConsuming(handler).then(function () {
      sender.send(message, messageType)
    })
  })
})
