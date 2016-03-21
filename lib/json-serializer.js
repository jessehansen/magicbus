'use strict';

var assert = require('assert-plus');

function JsonSerializer() {

}

Object.defineProperties(JsonSerializer.prototype, {
  contentTypeSuffix: {
    value: '+json',
    enumerable: true
  },

  serialize: {
    value: function(payload) {
      var json;
      if (payload) {
        json = JSON.stringify(payload);
        return new Buffer(json);
      }

      return null;
    },
    enumerable: true
  },

  deserialize: {
    value: function(content) {
      assert.buffer(content, 'content');

      return JSON.parse(content.toString('utf8'));
    },
    enumerable: true
  }
});

module.exports = JsonSerializer;
