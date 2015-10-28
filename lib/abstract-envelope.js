'use strict';

var assert = require('assert-plus');
var JsonSerializer = require('./json-serializer.js');

module.exports = AbstractEnvelope;

/**
 * Abstract implementation of the envelope pattern
 *
 * @public
 * @constructor
 * @param {Object} options
 * @param {Object} options.serializer - which serializer to use. Defaults to {@link JsonSerializer}
 */
function AbstractEnvelope(options) {
  assert.optionalObject(options, 'options');

  if (options) {
    assert.optionalObject(options.serializer, 'options.serializer');
  }

  var serializer = new JsonSerializer();
  if (options && options.serializer) {
    serializer = options.serializer;
  }

  Object.defineProperties(this, {
    _serializer: {
      value: serializer,
      enumerable: false
    }
  });
}

Object.defineProperties(AbstractEnvelope.prototype, {
  /**
   * Message content type
   *
   * @public
   * @abstract
   * @property {String}
   * @memberOf AbstractEnvelope.prototype
   */
  contentType: {
    value: undefined, //Leave this abstract
    enumerable: true
  },

  /**
   * Get full content type composed of its parts
   *
   * @private
   * @method
   */
  _getFullContentType: {
    value: function() {
      if (!this.contentType) {
        throw new Error('Content type not specified. When inheriting AbstractEnvelope be sure to override the contentType property.');
      }

      return this.contentType + this._serializer.contentTypeSuffix;
    },
    enumerable: false
  },

  /**
   * Serialize a message payload
   *
   * @public
   * @method
   * @memberof AbstractEnvelope.prototype
   * @param payload - the message payload
   * @returns serialized payload
   */
  serialize: {
    value: function(payload) {
      return this._serializer.serialize(payload);
    },
    enumerable: true
  },

  /**
   * Deserialize message content
   *
   * @public
   * @method
   * @memberof AbstractEnvelope.prototype
   * @param {Buffer} content - the message content
   * @returns deserialized content
   */
  deserialize: {
    value: function(content) {
      return this._serializer.deserialize(content);
    },
    enumerable: true
  }
});

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

