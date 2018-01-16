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
    // magicbus.on('log', ({ kind, namespace, message, err }) =>
    //   err
    //     ? console.log(namespace, kind, message, err)
    //     : console.log(namespace, kind, message))
    magicbus.on('unhandled-error', ({ message, messageTypes, err }) => console.log(message, messageTypes, err))
  })

  beforeEach(async () => {
    broker = magicbus.createBroker(serviceDomainName, appName, connectionInfo)
    sender = magicbus.createPublisher(broker, (cfg) => {
      cfg.useDefaultTopology({ autoDelete: true, durable: false })
      cfg.useRouteName('send')
    })
    receiver = magicbus.createConsumer(broker, (cfg) => {
      cfg.useDefaultTopology({ autoDelete: true, durable: false, exclusive: true })
      cfg.useRouteName('receive')
    })

    await broker.bind(sender, receiver, { pattern: '#' })
    await receiver.purgeQueue()
  })

  afterEach(() => {
    return broker.shutdown()
  })

  it('should be able to send a message and receive that message', (done) => {
    let message = {
      fooId: 123
    }
    let messageType = 'deactivateFooCommand'

    let handler = function ({ message, messageTypes }) {
      expect(message).toEqual(message)
      expect(messageTypes).toEqual([messageType])

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
    let handler = function ({ message, messageTypes, nack }) {
      if (first) {
        nack()
        first = false
        return
      }
      // should be processed again
      expect(message).toEqual(message)
      expect(messageTypes).toEqual([messageType])

      done()
    }

    receiver.startConsuming(handler).then(() => {
      sender.send(message, messageType)
    })
  })
})
