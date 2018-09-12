const JsonSerializer = require('../lib/serialization/json-serializer.js')

describe('JsonSerializer', () => {
  let serializer, context
  const next = () => Promise.resolve()
  const encoding = 'utf8'
  const contentTypeSuffix = '+json'

  beforeEach(() => {
    serializer = JsonSerializer({ encoding, contentTypeSuffix })
    context = { message: { my: 'data' }, publishOptions: { contentType: 'application/prs.magicbus' } }
  })

  describe('serialize', () => {
    it('should set content to a buffer containing the stringified payload', async () => {
      await serializer(context, next)

      expect(Buffer.isBuffer(context.content)).toEqual(true)
      expect(context.content.toString()).toEqual(JSON.stringify(context.message))
    })

    it('should support other encodings', async () => {
      serializer = JsonSerializer({ encoding: 'ascii', contentTypeSuffix })
      await serializer(context, next)

      expect(Buffer.isBuffer(context.content)).toEqual(true)
      expect(context.content.toString('ascii')).toEqual(JSON.stringify(context.message))
    })

    it('should add content type suffix to content type', async () => {
      await serializer(context, next)
      expect(context.publishOptions.contentType).toEqual('application/prs.magicbus+json')
    })

    it('should support other content type suffixes', async () => {
      serializer = JsonSerializer({ encoding, contentTypeSuffix: '-json' })
      await serializer(context, next)

      expect(context.publishOptions.contentType).toEqual('application/prs.magicbus-json')
    })

    it('should set content to null given no payload', async () => {
      context.message = null
      await serializer(context, next)

      expect(context.content).toBeNull()
    })

    it('should not change content type if one is not set', async () => {
      context.publishOptions = undefined
      await serializer(context, next)
      expect(context.publishOptions).toBeUndefined()
      context.publishOptions = {}
      await serializer(context, next)
      expect(context.publishOptions.contentType).toBeUndefined()
    })

    it('should support inspect', () => {
      expect(serializer.inspect()).toEqual({ type: 'JSON Serializer', encoding, contentTypeSuffix })
    })
  })
})
