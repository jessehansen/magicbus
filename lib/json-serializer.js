'use strict';

var assert = require('assert-plus');

module.exports = JsonSerializer;

function JsonSerializer() {

}

Object.defineProperties(JsonSerializer.prototype, {
  serialize: {
    value: function(payload) {
      if (payload) {
        var json = JSON.stringify(payload);
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