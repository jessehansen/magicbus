'use strict';

var assert = require('assert-plus');
var BasicEnvelope = require('./basic-envelope.js');
var JsonSerializer = require('./json-serializer.js');

module.exports = Consumer;

function Consumer(broker, options) {
  assert.object(broker, 'broker');
  assert.optionalObject(options, 'options');

  if (options) {
    assert.optionalObject(options.envelope, 'options.envelope');
    assert.optionalObject(options.serializer, 'options.serializer');
  }

  var envelope = new BasicEnvelope();
  if (options && options.envelope) {
    envelope = options.envelope;
  }

  var serializer = new JsonSerializer();
  if (options && options.serializer) {
    serializer = options.serializer;
  }

  this._broker = broker;
  this._envelope = envelope;
  this._serializer = serializer;
}

Object.defineProperties(Consumer.prototype, {
  _getDeserializedPayload: {
    value: function(originalMessage) {
      return this._serializer.deserialize(originalMessage.content);
    },
    enumerable: false
  },

  _getData: {
    value: function(msg) {
      return this._envelope.getData(msg);
    },
    enumerable: false
  },

  _getMessageTypes: {
    value: function(msg) {
      return this._envelope.getMessageTypes(msg);
    },
    enumerable: false
  }
});
