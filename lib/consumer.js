'use strict';

var assert = require('assert-plus');
var _ = require('lodash');
var BasicEnvelope = require('./basic-envelope.js');
var ConsumerPipeline = require('./middleware').ConsumerPipeline;

module.exports = Consumer;

function Consumer(broker, options) {
  assert.object(broker, 'broker');
  assert.optionalObject(options, 'options');

  if (options) {
    assert.optionalObject(options.envelope, 'options.envelope');
    assert.optionalObject(options.pipeline, 'options.pipeline');
  }

  var envelope = new BasicEnvelope();
  if (options && options.envelope) {
    envelope = options.envelope;
  }

  var pipeline;
  if (options && options.pipeline && !Array.isArray(options.pipeline)) {
    assert.func(options.pipeline.execute);
    pipeline = options.pipeline;
  } else if (options) {
    assert.optionalArrayOfFunc(options.pipeline);
    pipeline = new ConsumerPipeline(options.pipeline);
  } else {
    pipeline = new ConsumerPipeline();
  }

  this._broker = broker;
  this._envelope = envelope;
  this._pipeline = pipeline;
}

Object.defineProperties(Consumer.prototype, {
  _getDeserializedMessage: {
    value: function(originalMessage) {
      var msg = {
        properties: {},
        fields: {},
        payload: this._getDeserializedPayload(originalMessage)
      };

      _.assign(msg.properties, originalMessage.properties);
      _.assign(msg.fields, originalMessage.fields);

      return msg;
    },
    enumerable: false
  },

  _getDeserializedPayload: {
    value: function(originalMessage) {
      return this._envelope.deserialize(originalMessage.content);
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
