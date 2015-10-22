'use strict';

var assert = require('assert-plus');
var util = require('util');
var AbstractEnvelope = require('./abstract-envelope.js');

module.exports = BasicEnvelope;

function BasicEnvelope(options) {
  AbstractEnvelope.call(this, options);
}
util.inherits(BasicEnvelope, AbstractEnvelope);

Object.defineProperties(BasicEnvelope.prototype, {
  contentType: {
    value: 'application/prs.magicbus',
    enumerable: true
  },

  //Producer side functions
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

  getRoutingKey: {
    value: function(data, kind) {
      return kind;
    },
    enumerable: true
  },

  //Consumer side functions
  getData: {
    value: function(message) {
      assert.object(message, 'message');

      return message.payload || null;
    },
    enumerable: true
  },

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