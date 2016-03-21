'use strict';

var assert = require('assert-plus');
var util = require('util');
var AbstractEnvelope = require('./abstract-envelope.js');

/**
 * Basic implementation of {@link AbstractEnvelope}
 *
 * @public
 * @constructor
 * @param {Object} options
 * @param {Object} options.serializer - which serializer to use. Defaults to {@link JsonSerializer}
 */
function BasicEnvelope(options) {
  AbstractEnvelope.call(this, options);
}
util.inherits(BasicEnvelope, AbstractEnvelope);

Object.defineProperties(BasicEnvelope.prototype, {
  /**
   * Message content type - set to "application/prs.magicbus"
   *
   * @public
   * @property {String}
   * @memberOf BasicEnvelope.prototype
   */
  contentType: {
    value: 'application/prs.magicbus',
    enumerable: true
  },

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
  getMessage: {
    value: function(data, kind) {
      return {
        properties: {
          contentType: this._getFullContentType(),
          type: kind
        },
        payload: data
      };
    },
    enumerable: true
  },

  /**
   * Sending: Get a message's routing key
   *
   * @method
   * @memberOf BasicEnvelope.prototype
   * @param {Object} data - unpacked data
   * @param {String} kind - message type or event name
   * @returns {String} routing key
   */
  getRoutingKey: {
    value: function(data, kind) {
      return kind;
    },
    enumerable: true
  },

  /**
   * Receiving: Get deserialized message data from a raw message
   *
   * @method
   * @memberOf BasicEnvelope.prototype
   * @param {Object} message - raw message
   * @returns {Object} message data
   */
  getData: {
    value: function(message) {
      assert.object(message, 'message');

      return message.payload || null;
    },
    enumerable: true
  },

  /**
   * Receiving: Get message types from a raw message
   *
   * @method
   * @memberOf BasicEnvelope.prototype
   * @param {Object} message - raw message
   * @returns {Array} message types
   */
  getMessageTypes: {
    value: function(message) {
      assert.object(message, 'message');

      if (message.properties && message.properties.type) {
        return [message.properties.type];
      }

      return [];
    },
    enumerable: true
  }
});

module.exports = BasicEnvelope;
