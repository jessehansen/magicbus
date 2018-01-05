const magicbus = require('../lib')
const environment = require('./_test-env')
const Promise = require('bluebird')

describe('Pub/Sub integration', function () {
  let serviceDomainName = 'magicbus'
  let appName = 'tests'
  let connectionInfo = environment.rabbitString
  let broker
  let publisher
  let subscriber

  beforeAll(function () {
    broker = magicbus.createBroker(serviceDomainName, appName, connectionInfo)
    publisher = magicbus.createPublisher(broker)
    subscriber = magicbus.createSubscriber(broker)

    return broker.bind(publisher.getRoute().name, subscriber.getRoute().name, { pattern: '#' })
      .then(function () {
        return subscriber.purgeQueue()
      })
  })

  afterAll(function () {
    return broker.shutdown()
  })

  it('should be able to publish a message and consume that message', function (done) {
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
    subscriber.startSubscription().then(function () {
      publisher.publish(eventName, data)
    })
  })

  xit('should handle a heavy load without rejecting because of a full write buffer', function () {
    this.timeout(30000)
    let load = []
    for (let i = 0; i < 100000; ++i) {
      load.push('message ' + i)
    }
    return Promise.map(load, function (message) {
      return publisher.publish('load-test', { message: message })
    })
  })
})
