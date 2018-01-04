
const assert = require('assert-plus')
const JsonSerializer = require('./json-serializer.js')

/**
 * Abstract implementation of the envelope pattern
 * @public
 */
class AbstractEnvelope {
  /**
   * Create a new envelope
   *
   * @public
   * @param {Object} options
   * @param {Object} options.serializer - which serializer to use. Defaults to {@link JsonSerializer}
   */
  constructor (options) {
    assert.optionalObject(options, 'options')

    if (options) {
      assert.optionalObject(options.serializer, 'options.serializer')
    }

    let serializer = new JsonSerializer()
    if (options && options.serializer) {
      serializer = options.serializer
    }

    this._serializer = serializer
    this.contentType = undefined
    this.encoding = serializer.encoding
  }

  /**
   * Get full content type composed of its parts
   *
   * @protected
   * @method
   */
  _getFullContentType () {
    if (!this.contentType) {
      throw new Error('Content type not specified. When inheriting AbstractEnvelope be sure to override the contentType property.')
    }

    return this.contentType + this._serializer.contentTypeSuffix
  }

  /**
   * Serialize a message payload
   *
   * @public
   * @method
   * @memberof AbstractEnvelope.prototype
   * @param payload - the message payload
   * @returns serialized payload
   */
  serialize (payload) {
    return this._serializer.serialize(payload)
  }

  /**
   * Deserialize message content
   *
   * @public
   * @method
   * @memberof AbstractEnvelope.prototype
   * @param {Buffer} content - the message content
   * @returns deserialized content
   */
  deserialize (content) {
    return this._serializer.deserialize(content)
  }
};

module.exports = AbstractEnvelope

/**
 * Publishing: Get a serialized message
 * @name getMessage
 * @abstract
 * @method
 * @memberOf AbstractEnvelope.prototype
 * @param {Object} data - unpacked data
 * @param {String} kind - message type or event name
 * @returns {Object} serialized message
 */

/**
 * Publishing: Get a message's routing key
 * @name getRoutingKey
 * @abstract
 * @method
 * @memberOf AbstractEnvelope.prototype
 * @param {Object} data - unpacked data
 * @param {String} kind - message type or event name
 * @returns {String} routing key
 */

/**
 * Receiving: Get deserialized message data from a raw message
 * @name getData
 * @abstract
 * @method
 * @memberOf AbstractEnvelope.prototype
 * @param {Object} message - raw message
 * @returns {Object} message data
 */

/**
 * Receiving: Get message types from a raw message
 * @name getMessageTypes
 * @abstract
 * @method
 * @memberOf AbstractEnvelope.prototype
 * @param {Object} message - raw message
 * @returns {Array} message types
 */

