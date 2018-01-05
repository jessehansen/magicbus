const BasicEnvelope = require('../lib/basic-envelope')
const JsonSerializer = require('../lib/json-serializer')

describe('BasicEnvelope', function () {
  let envelope

  beforeEach(function () {
    envelope = new BasicEnvelope()
  })

  describe('default construction', function () {
    it('should use the json serializer', function () {
      expect(envelope._serializer instanceof JsonSerializer).toEqual(true)
    })
  })

  describe('construction options', function () {
    it('should use the serializer passed in the options', function () {
      let serializer = {}
      envelope = new BasicEnvelope({
        serializer: serializer
      })

      expect(envelope._serializer).toEqual(serializer)
    })
  })

  describe('contentType', function () {
    it('should return a hardcoded value in all cases', function () {
      expect(envelope.contentType).toEqual('application/prs.magicbus')
    })
  })

  describe('getMessage', function () {
    it('should set the content type', function () {
      let msg = envelope.getMessage({
        my: 'data'
      }, 'my-kind')

      expect(msg.properties.contentType).toEqual('application/prs.magicbus+json')
    })

    it('should put the kind of the message in the type property of the amqp properties', function () {
      let msg = envelope.getMessage({
        my: 'data'
      }, 'my-kind')

      expect(msg.properties.type).toEqual('my-kind')
    })

    it('should put the data of the message in the payload', function () {
      let msg = envelope.getMessage({
        my: 'data'
      }, 'my-kind')

      let expected = {
        my: 'data'
      }
      expect(msg.payload).toEqual(expected)
    })
  })

  describe('getRoutingKey', function () {
    it('should return the kind of the message', function () {
      let routingKey = envelope.getRoutingKey({
        my: 'data'
      }, 'my-kind')

      expect(routingKey).toEqual(routingKey)
    })
  })

  describe('getData', function () {
    it('should return the payload given a message with a payload', function () {
      let msg = {
        payload: {
          my: 'data'
        }
      }

      let data = envelope.getData(msg)

      let expected = {
        my: 'data'
      }
      expect(data).toEqual(expected)
    })

    it('should return null given a message with no payload', function () {
      let msg = {}

      let data = envelope.getData(msg)

      expect(data).toEqual(null)
    })

    it('should throw an assertion error given no message', function () {
      let fn = function () {
        envelope.getData()
      }

      expect(fn).toThrow('message (object) is required')
    })
  })

  describe('getMessageTypes', function () {
    it('should return the type property of the amqp properties as the only message type given a message with a type', function () {
      let msg = {
        properties: {
          type: 'my-kind'
        }
      }

      let messageTypes = envelope.getMessageTypes(msg)

      expect(messageTypes).toEqual(['my-kind'])
    })

    it('should return an empty array given a message with no type', function () {
      let msg = {}

      let messageTypes = envelope.getMessageTypes(msg)

      expect(messageTypes).toEqual([])
    })

    it('should throw an assertion error given no message', function () {
      let fn = function () {
        envelope.getMessageTypes()
      }

      expect(fn).toThrow('message (object) is required')
    })
  })
})
