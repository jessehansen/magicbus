const magicbus = require('..')
const environment = require('./_test-env')

describe('Pub/Sub integration', () => {
  let serviceDomainName = 'magicbus'
  let appName = 'tests'
  let connectionInfo = environment.rabbitString
  let broker
  let publisher
  let subscriber

  beforeAll(() => {
    // magicbus.on('log', ({ kind, namespace, message, err }) =>
    //   err
    //     ? console.log(namespace, kind, message, err)
    //     : console.log(namespace, kind, message))
    // magicbus.on('unhandled-error', ({ message, messageTypes, err }) => console.log(message, messageTypes, err))
  })

  beforeEach(async () => {
    broker = magicbus.createBroker(serviceDomainName, appName, connectionInfo)
    publisher = magicbus.createPublisher(broker, (cfg) => {
      cfg.useDefaultTopology({ autoDelete: true, durable: false })
    })
    subscriber = magicbus.createSubscriber(broker, (cfg) => {
      cfg.useDefaultTopology({ autoDelete: true, durable: false, exclusive: true })
    })

    await broker.bind(publisher, subscriber, { pattern: '#' })
    await subscriber.purgeQueue()
  })

  afterEach(() => {
    return broker.shutdown()
  })

  it('should be able to publish a message and consume that message', (done) => {
    let eventName = 'something-done'
    let data = {
      it: 'was awesome'
    }

    let handler = function (handlerEventName, { message }) {
      expect(handlerEventName).toEqual(eventName)
      expect(message).toEqual(data)

      done()
    }

    subscriber.on('something-done', handler)
    subscriber.startSubscription().then(() => {
      publisher.publish(eventName, data)
    })
  })

  it('should reject message when consumption fails', (done) => {
    let eventName = 'something-done'
    let data = {
      it: 'kind of sucked'
    }

    let handler = () => {
      return Promise.reject('an error')
    }

    let failedQueueHandler = (handlerEventName, { message }) => {
      expect(handlerEventName).toEqual(eventName)
      expect(message).toEqual(data)
      done()
    }
    let failedQueueSubscriber

    subscriber.on('something-done', handler)
    subscriber.startSubscription()
      .then(() => {
        failedQueueSubscriber = magicbus.createSubscriber(broker,
          (cfg) => {
            cfg.useExistingQueue(`${serviceDomainName}.${appName}.subscribe.failed`)
          })
        failedQueueSubscriber.on(/.*/, failedQueueHandler)
        return failedQueueSubscriber.startSubscription()
      })
      .then(() => failedQueueSubscriber.purgeQueue())
      .then(() =>
        publisher.publish(eventName, data)
      )
  })

  xit('should handle a heavy load without rejecting because of a full write buffer', () => {
    jest.setTimeout(30000)
    let load = []
    for (let i = 0; i < 100000; ++i) {
      load.push('message ' + i)
    }
    return Promise.all(load.map((message) => publisher.publish('load-test', { message: message })))
  })
})
