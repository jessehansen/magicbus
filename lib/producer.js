'use strict';

var assert = require('assert-plus');
var BasicEnvelope = require('./basic-envelope.js');
var JsonSerializer = require('./json-serializer.js');

module.exports = Producer;

function Producer(broker, options) {
  assert.object(broker, 'broker');
  assert.optionalObject(options, 'options');

  if (options) {
    assert.optionalString(options.routingKeyPrefix, 'options.routingKeyPrefix');
    assert.optionalObject(options.envelope, 'options.envelope');
  }

  var routingKeyPrefix = null;
  if (options && options.routingKeyPrefix) {
    routingKeyPrefix = options.routingKeyPrefix;
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
  this._defaultRoutingKeyPrefix = routingKeyPrefix;
  this._envelope = envelope;
  this._serializer = serializer;
}

Object.defineProperties(Producer.prototype, {
  _getMessage: {
    value: function(data, kind) {
      return this._envelope.getMessage(data, kind);
    },
    enumerable: false
  },

  _getRoutingKey: {
    value: function(options, eventName) {
      var routingKeyPrefix = this._defaultRoutingKeyPrefix;

      if (options && options.routingKeyPrefix) {
        routingKeyPrefix = options.routingKeyPrefix;
      }

      return routingKeyPrefix ? routingKeyPrefix + '.' + eventName : eventName;
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