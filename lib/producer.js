'use strict';

var assert = require('assert-plus');
var BasicEnvelope = require('./basic-envelope.js');
var JsonSerializer = require('./json-serializer.js');
var ProducerPipeline = require('./middleware').ProducerPipeline;

module.exports = Producer;

function Producer(broker, options) {
  assert.object(broker, 'broker');
  assert.optionalObject(options, 'options');

  if (options) {
    assert.optionalObject(options.envelope, 'options.envelope');
    assert.optionalObject(options.serializer, 'options.serializer');
    assert.optionalObject(options.pipeline, 'options.pipeline');
  }

  var envelope = new BasicEnvelope();
  if (options && options.envelope) {
    assert.object(options.envelope);
    envelope = options.envelope;
  }

  var serializer = new JsonSerializer();
  if (options && options.serializer) {
    assert.object(options.serializer);
    serializer = options.serializer;
  }

  var pipeline;
  if (options && options.pipeline && !Array.isArray(options.pipeline)) {
    assert.func(options.pipeline.execute);
    pipeline = options.pipeline;
  } else if (options) {
    assert.optionalArrayOfFunc(options.pipeline);
    pipeline = new ProducerPipeline(options.pipeline);
  } else {
    pipeline = new ProducerPipeline();
  }

  this._broker = broker;
  this._envelope = envelope;
  this._serializer = serializer;
  this._pipeline = pipeline;
}

Object.defineProperties(Producer.prototype, {
  _getMessage: {
    value: function(data, kind) {
      return this._envelope.getMessage(data, kind);
    },
    enumerable: false
  },

  _getRoutingKey: {
    value: function(data, kind) {
      return this._envelope.getRoutingKey(data, kind);
    },
    enumerable: false
  },

  _getSerializedContent: {
    value: function(payload) {
      return this._serializer.serialize(payload);
    },
    enumerable: false
  },

  _getPublishOptions: {
    value: function(msg) {
      //Should copy all of msg.properties and set some defaults
      return {
        persistent: true,
        type: msg.properties.type
      };
    },
    enumerable: false
  }
});
