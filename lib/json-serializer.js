
let assert = require('assert-plus')

/**
 * Serializes/Deserializes using JSON
 */
class JsonSerializer {
  /**
   * Create a new JsonSerializer
   * @param {String} encoding - character encoding. Defaults to utf8
   */
  constructor (encoding) {
    this.contentTypeSuffix = '+json'
    this.encoding = encoding || 'utf8'
  }

  /**
   * Serialize the payload
   * @param {Any} payload - the content to serialize
   * @returns {Buffer} serialized content
   */
  serialize (payload) {
    if (payload) {
      return Buffer.from(JSON.stringify(payload), this.encoding)
    }

    return null
  }

  /**
   * Deserialize a buffer into an object
   * @param {Buffer} content - the content to deserialize
   * @returns {Any} deserialized content
   */
  deserialize (content) {
    assert.buffer(content, 'content')

    return JSON.parse(content.toString(this.encoding))
  }
}

module.exports = JsonSerializer
