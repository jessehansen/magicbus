
const assert = require('assert-plus')
const AbstractEnvelope = require('./abstract-envelope.js')

/**
 * Basic implementation of {@link AbstractEnvelope}
 *
 * @public
 * @constructor
 * @param {Object} options
 * @param {Object} options.serializer - which serializer to use. Defaults to {@link JsonSerializer}
 */
class BasicEnvelope extends AbstractEnvelope {
  constructor (options) {
    super(options)
    this.contentType = 'application/prs.magicbus'
  }

  /**
   * Sending: Get a serialized message.
   *
   * @public
   * @method
   * @memberOf BasicEnvelope.prototype
   * @param {Object} data - unpacked data
   * @param {String} kind - message type or event name
   * @returns {Object} serialized message
   */
  getMessage (data, kind) {
    return {
      properties: {
        contentType: this._getFullContentType(),
        type: kind
      },
      payload: data
    }
  }

  /**
   * Sending: Get a message's routing key
   *
   * @method
   * @memberOf BasicEnvelope.prototype
   * @param {Object} data - unpacked data
   * @param {String} kind - message type or event name
   * @returns {String} routing key
   */
  getRoutingKey (data, kind) {
    return kind
  }

  /**
   * Receiving: Get deserialized message data from a raw message
   *
   * @method
   * @memberOf BasicEnvelope.prototype
   * @param {Object} message - raw message
   * @returns {Object} message data
   */
  getData (message) {
    assert.object(message, 'message')

    return message.payload || null
  }

  /**
   * Receiving: Get message types from a raw message
   *
   * @method
   * @memberOf BasicEnvelope.prototype
   * @param {Object} message - raw message
   * @returns {Array} message types
   */
  getMessageTypes (message) {
    assert.object(message, 'message')

    if (message.properties && message.properties.type) {
      return [message.properties.type]
    }

    return []
  }
}

module.exports = BasicEnvelope
