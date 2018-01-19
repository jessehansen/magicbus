const magicbus = require('../lib')
const amqp = require('amqplib')
const environment = require('./_test-env')

describe('Binder really using RabbitMQ', () => {
  const serviceDomainName = 'magicbus'
  const appName = 'tests'
  const connectionInfo = environment.rabbit
  const exchangeName = `${serviceDomainName}.${appName}.binder-exchange`
  const otherExchangeName = `${serviceDomainName}.${appName}.binder-other-exchange`
  const queueName = `${serviceDomainName}.${appName}.binder-queue`
  let binder

  beforeAll(async () => {
    // binder requires that the source & targets already exist, so control them manually here
    let cxn = await amqp.connect(`amqp://${connectionInfo.user}:${connectionInfo.pass}@${connectionInfo.server}/`)
    let chn = await cxn.createChannel()
    await chn.assertQueue(queueName)
    await chn.assertExchange(exchangeName)
    await chn.assertExchange(otherExchangeName)
    await cxn.close()

    binder = magicbus.createBinder(connectionInfo)
  })

  afterAll(async () => {
    await binder.shutdown()

    let cxn = await amqp.connect(`amqp://${connectionInfo.user}:${connectionInfo.pass}@${connectionInfo.server}/`)
    let chn = await cxn.createChannel()
    await chn.deleteQueue(queueName)
    await chn.deleteExchange(exchangeName)
    await chn.deleteExchange(otherExchangeName)
    await cxn.close()
  })

  it('should be able to bind an exchange to a queue', () => {
    return binder.bind({
      source: exchangeName,
      target: queueName,
      keys: ['#']
    })
  })

  it('should be able to bind an exchange to an exchange', () => {
    return binder.bind({
      source: exchangeName,
      target: otherExchangeName,
      queue: false,
      keys: ['#']
    })
  })
})
