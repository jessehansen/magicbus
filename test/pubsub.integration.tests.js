const magicbus = require('../lib')
const environment = require('./_test-env')
const Promise = require('bluebird')

describe('Pub/Sub integration', () => {
  let serviceDomainName = 'magicbus'
  let appName = 'tests'
  let connectionInfo = environment.rabbitString
  let broker
  let publisher
  let subscriber

  beforeAll(() => {
    broker = magicbus.createBroker(serviceDomainName, appName, connectionInfo)
    publisher = magicbus.createPublisher(broker)
    subscriber = magicbus.createSubscriber(broker)

    return broker.bind(publisher.getRoute().name, subscriber.getRoute().name, { pattern: '#' })
      .then(() => {
        return subscriber.purgeQueue()
      })
  })

  afterAll(() => {
    return broker.shutdown()
  })

  it('should be able to publish a message and consume that message', (done) => {
    let eventName = 'something-done'
    let data = {
      it: 'was awesome'
    }

    let handler = function (handlerEventName, handlerData) {
      expect(handlerEventName).toEqual(eventName)
      expect(handlerData).toEqual(data)

      done()
    }

    subscriber.on('something-done', handler)
    subscriber.startSubscription().then(() => {
      publisher.publish(eventName, data)
    })
  })

  it('should handle a heavy load without rejecting because of a full write buffer', () => {
    jest.setTimeout(30000)
    let load = []
    for (let i = 0; i < 100000; ++i) {
      load.push('message ' + i)
    }
    return Promise.map(load, (message) => publisher.publish('load-test', { message: message }))
  })
})
