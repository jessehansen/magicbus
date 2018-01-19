const magicbus = require('..')
const environment = require('./_test-env')
const serviceDomainName = 'magicbus'
const appName = 'tests'
const connectionInfo = environment.rabbit

describe('MagicBus', () => {
  describe('#createBroker', () => {
    it('should fail given no serviceDomainName', () => {
      expect(() => magicbus.createBroker(null, appName, connectionInfo)).toThrow()
    })
    it('should fail given no appName', () => {
      expect(() => magicbus.createBroker(serviceDomainName, null, connectionInfo)).toThrow()
    })
    it('should fail given no connectionInfo', () => {
      expect(() => magicbus.createBroker(serviceDomainName, appName, null)).toThrow()
    })
    it('should fail given non-function configurator', () => {
      expect(() => magicbus.createBroker(serviceDomainName, appName, connectionInfo, 'lah dee dah')).toThrow()
    })
  })
  describe('#createPublisher', () => {
    it('should fail given no broker', () => {
      expect(() => magicbus.createPublisher(null)).toThrow()
    })
    it('should fail given non-function configurator', () => {
      expect(() => magicbus.createPublisher({}, 'lah dee dah')).toThrow()
    })
  })
  describe('#createConsumer', () => {
    it('should fail given no broker', () => {
      expect(() => magicbus.createConsumer(null)).toThrow()
    })
    it('should fail given non-function configurator', () => {
      expect(() => magicbus.createConsumer({}, 'lah dee dah')).toThrow()
    })
  })
  describe('#createSubscriber', () => {
    it('should fail given no broker', () => {
      expect(() => magicbus.createSubscriber(null)).toThrow()
    })
    it('should fail given non-function configurator', () => {
      expect(() => magicbus.createSubscriber({}, 'lah dee dah')).toThrow()
    })
  })
  describe('#createBinder', () => {
    it('should fail given no connectionInfo', () => {
      expect(() => magicbus.createBinder(null)).toThrow()
    })
    it('should fail given non-function configurator', () => {
      expect(() => magicbus.createBinder(connectionInfo, 'lah dee dah')).toThrow()
    })
  })
  describe('#on', () => {
    it('should allow subscribing to events', () => {
      expect(() => magicbus.on('log', () => {})).not.toThrow()
    })
  })
})
