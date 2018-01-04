
let JsonSerializer = require('../lib/json-serializer.js')

let chai = require('chai')
let expect = chai.expect

describe('JsonSerializer', function () {
  let serializer

  beforeEach(function () {
    serializer = new JsonSerializer()
  })

  describe('contentTypeSuffix', function () {
    it('should return a hardcoded value in all cases', function () {
      expect(serializer.contentTypeSuffix).to.eq('+json')
    })
  })

  describe('serialize', function () {
    it('should return a buffer containing the stringified payload', function () {
      let payload = {
        my: 'data'
      }

      let actual = serializer.serialize(payload)

      expect(Buffer.isBuffer(actual)).to.eq(true)
      expect(actual.toString()).to.eq(JSON.stringify(payload))
    })

    it('should return null given no payload', function () {
      let actual = serializer.serialize(null)

      expect(actual).to.eq(null)
    })
  })

  describe('deserialize', function () {
    it('should return an object given a buffer containing a stringified object', function () {
      let payload = {
        my: 'data'
      }

      let content = Buffer.from(JSON.stringify(payload))

      let result = serializer.deserialize(content)

      expect(result).to.eql(payload)
    })

    it('should return a string given a buffer containing a string that is not a stringified object', function () {
      let payload = 'ok'

      let content = Buffer.from(JSON.stringify(payload))

      let result = serializer.deserialize(content)

      expect(result).to.eq('ok')
    })

    it('should return an integer given a buffer containing an integer', function () {
      let payload = 123

      let content = Buffer.from(JSON.stringify(payload))

      let result = serializer.deserialize(content)

      expect(result).to.eq(123)
    })

    it('should throw an assertion error given it is not passed a buffer', function () {
      let fn = function () {
        serializer.deserialize()
      }

      expect(fn).to.throw('content (buffer) is required')
    })
  })
})
