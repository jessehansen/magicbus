const magicbus = require('..')
const environment = require('./_test-env')
const Promise = require('bluebird')

describe('Pub/Sub integration', () => {
  let serviceDomainName = 'magicbus'
  let appName = 'tests'
  let connectionInfo = environment.rabbitString
  let broker
  let publisher
  let subscriber
  let failedQueueSubscriber

  beforeEach(async () => {
    broker = magicbus.createBroker(serviceDomainName, appName, connectionInfo)
    publisher = magicbus.createPublisher(broker, (cfg) =>
      cfg.useRoutePattern(magicbus.routePatterns.publisher({ autoDelete: true, durable: false })))
    subscriber = magicbus.createSubscriber(broker, (cfg) =>
      cfg.useRoutePattern(magicbus.routePatterns.worker({ autoDelete: true, durable: false, exclusive: true })))
    failedQueueSubscriber = magicbus.createSubscriber(broker,
      (cfg) => {
        // TODO: it's really confusing why this doesn't work unless you set a different route name
        cfg.useRoutePattern(magicbus.routePatterns.existingTopology({
          queueName: `${serviceDomainName}.${appName}.subscribe.failed`
        }))
        cfg.useRouteName('subscribe-failed')
      })

    await broker.bind(publisher.getRoute().name, subscriber.getRoute().name, { pattern: '#' })
    await subscriber.purgeQueue()
    await failedQueueSubscriber.purgeQueue()
  })

  afterEach(() => {
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

  it('should reject message when consumption fails', (done) => {
    let eventName = 'something-done'
    let data = {
      it: 'kind of sucked'
    }

    let handler = () => {
      return Promise.reject('an error')
    }

    let failedQueueHandler = (handlerEventName, handlerData) => {
      expect(handlerEventName).toEqual(eventName)
      expect(handlerData).toEqual(data)
      done()
    }

    subscriber.on('something-done', handler)
    failedQueueSubscriber.on(/.*/, failedQueueHandler)
    subscriber.startSubscription().then(() =>
      failedQueueSubscriber.startSubscription()
    ).then(() =>
      publisher.publish(eventName, data)
    )
  })

  xit('should handle a heavy load without rejecting because of a full write buffer', () => {
    jest.setTimeout(30000)
    let load = []
    for (let i = 0; i < 100000; ++i) {
      load.push('message ' + i)
    }
    return Promise.map(load, (message) => publisher.publish('load-test', { message: message }))
  })
})
