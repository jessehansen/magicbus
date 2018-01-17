const MagicEnvelope = require('../lib/magic-envelope')

describe('MagicEnvelope', () => {
  let envelope
  let context
  const next = () => Promise.resolve()

  beforeEach(() => {
    envelope = MagicEnvelope()
  })

  describe('wrap', () => {
    beforeEach(() => {
      context = { kind: 'my-kind' }
    })

    it('should set the content type', async () => {
      await envelope.wrap(context, next)

      expect(context.publishOptions.contentType).toEqual('application/prs.magicbus')
    })

    it('should support overriding the content type', async () => {
      envelope = MagicEnvelope({ contentType: 'something' })
      await envelope.wrap(context, next)

      expect(context.publishOptions.contentType).toEqual('something')
    })

    it('should put the kind of the message in the type property of the amqp properties', async () => {
      await envelope.wrap(context, next)

      expect(context.publishOptions.type).toEqual('my-kind')
    })

    it('should set the kind of the message as the routing key', async () => {
      await envelope.wrap(context, next)

      expect(context.routingKey).toEqual('my-kind')
    })

    it('should support inspect', async () => {
      expect(envelope.wrap.inspect()).toEqual({ type: 'Magic Envelope Wrap', contentType: 'application/prs.magicbus' })
    })
  })

  describe('unwrap', () => {
    it('should return the type property of the amqp properties as the only message type given a message with a type', async () => {
      let context = {
        properties: {
          type: 'my-kind'
        }
      }

      await envelope.unwrap(context, next)

      expect(context.messageTypes).toEqual(['my-kind'])
    })

    it('should return an empty array given a message with no type', async () => {
      let context = {}

      await envelope.unwrap(context, next)

      expect(context.messageTypes).toEqual([])
    })

    it('should support inspect', async () => {
      expect(envelope.unwrap.inspect()).toEqual({ type: 'Magic Envelope Unwrap' })
    })
  })
})
