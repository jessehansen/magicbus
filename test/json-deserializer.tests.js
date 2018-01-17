const JsonDeserializer = require('../lib/serialization/json-deserializer.js')

describe('JsonDeserializer', () => {
  let deserializer, context
  const next = () => Promise.resolve()
  const payload = { my: 'data' }

  beforeEach(() => {
    deserializer = JsonDeserializer()
    context = { content: Buffer.from(JSON.stringify(payload)) }
  })

  describe('deserialize', () => {
    it('should set the message given content is a buffer containing a stringified object', async () => {
      await deserializer(context, next)

      expect(context.message).toEqual(payload)
    })

    it('should support other encodings', async () => {
      deserializer = JsonDeserializer({ encoding: 'ascii' })
      context.content = Buffer.from(JSON.stringify(payload), 'ascii')
      await deserializer(context, next)

      expect(context.message).toEqual(payload)
    })

    it('should return a string given a buffer containing a string that is not a stringified object', async () => {
      let payload = 'ok'

      context.content = Buffer.from(JSON.stringify(payload))

      await deserializer(context, next)

      expect(context.message).toEqual('ok')
    })

    it('should return an integer given a buffer containing an integer', async () => {
      let payload = 123

      context.content = Buffer.from(JSON.stringify(payload))

      await deserializer(context, next)

      expect(context.message).toEqual(123)
    })

    it('should support inspect', () => {
      expect(deserializer.inspect()).toEqual({ type: 'JSON Deserializer', encoding: 'utf8' })
    })
  })
})
