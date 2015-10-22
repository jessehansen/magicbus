'use strict';

var assert = require('assert-plus');
var _ = require('lodash');
var BasicEnvelope = require('./basic-envelope.js');

module.exports = Producer;

function Producer(broker, options) {
  assert.object(broker, 'broker');
  assert.optionalObject(options, 'options');

  if (options) {
    assert.optionalObject(options.envelope, 'options.envelope');
  }

  var envelope = new BasicEnvelope();
  if (options && options.envelope) {
    envelope = options.envelope;
  }

  this._broker = broker;
  this._envelope = envelope;
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
      return this._envelope.serialize(payload);
    },
    enumerable: false
  },

  _getPublishOptions: {
    value: function(msg, perCallPublishOptions) {
      var publishOptions = {};

      var defaults = {
        persistent: true
      };

      _.assign(publishOptions, defaults, msg.properties, perCallPublishOptions);

      return publishOptions;
    },
    enumerable: false
  }
});