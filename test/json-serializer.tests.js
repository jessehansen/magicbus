const jsonSerializer = require('../lib/json-serializer.js')

describe('JsonSerializer', () => {
  let serializer

  beforeEach(() => {
    serializer = jsonSerializer()
  })

  describe('contentTypeSuffix', () => {
    it('should return a hardcoded value in all cases', () => {
      expect(serializer.contentTypeSuffix).toEqual('+json')
    })
  })

  describe('serialize', () => {
    it('should return a buffer containing the stringified payload', () => {
      let payload = {
        my: 'data'
      }

      let actual = serializer.serialize(payload)

      expect(Buffer.isBuffer(actual)).toEqual(true)
      expect(actual.toString()).toEqual(JSON.stringify(payload))
    })

    it('should return null given no payload', () => {
      let actual = serializer.serialize(null)

      expect(actual).toEqual(null)
    })
  })

  describe('deserialize', () => {
    it('should return an object given a buffer containing a stringified object', () => {
      let payload = {
        my: 'data'
      }

      let content = Buffer.from(JSON.stringify(payload))

      let result = serializer.deserialize(content)

      expect(result).toEqual(payload)
    })

    it('should return a string given a buffer containing a string that is not a stringified object', () => {
      let payload = 'ok'

      let content = Buffer.from(JSON.stringify(payload))

      let result = serializer.deserialize(content)

      expect(result).toEqual('ok')
    })

    it('should return an integer given a buffer containing an integer', () => {
      let payload = 123

      let content = Buffer.from(JSON.stringify(payload))

      let result = serializer.deserialize(content)

      expect(result).toEqual(123)
    })

    it('should throw an assertion error given it is not passed a buffer', () => {
      let fn = () => {
        serializer.deserialize()
      }

      expect(fn).toThrow('content (buffer) is required')
    })
  })
})
