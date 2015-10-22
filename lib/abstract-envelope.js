'use strict';

var assert = require('assert-plus');
var JsonSerializer = require('./json-serializer.js');

module.exports = AbstractEnvelope;

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
  contentType: {
    value: undefined, //Leave this abstract
    enumerable: true
  },

  _getFullContentType: {
    value: function() {
      if (!this.contentType) {
        throw new Error('Content type not specified. When inheriting AbstractEnvelope be sure to override the contentType property.');
      }

      return this.contentType + this._serializer.contentTypeSuffix;
    },
    enumerable: false
  },

  serialize: {
    value: function(payload) {
      return this._serializer.serialize(payload);
    },
    enumerable: true
  },

  deserialize: {
    value: function(content) {
      return this._serializer.deserialize(content);
    },
    enumerable: true
  }
});