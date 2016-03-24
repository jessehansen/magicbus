'use strict';

var assert = require('assert-plus');

/**
 * Serializes/Deserializes using JSON
 */
class JsonSerializer {
  /**
   * Create a new JsonSerializer
   */
  constructor() {
    this.contentTypeSuffix = '+json';
  }

  /**
   * Serialize the payload
   * @param {Any} payload - the content to serialize
   * @returns {Buffer} serialized content
   */
  serialize(payload) {
    var json;
    if (payload) {
      json = JSON.stringify(payload);
      return new Buffer(json);
    }

    return null;
  }

  /**
   * Deserialize a buffer into an object
   * @param {Buffer} content - the content to deserialize
   * @returns {Any} deserialized content
   */
  deserialize(content) {
    assert.buffer(content, 'content');

    return JSON.parse(content.toString('utf8'));
  }
}

module.exports = JsonSerializer;
