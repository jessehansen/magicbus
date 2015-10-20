'use strict';

var assert = require('assert-plus');

module.exports = BasicEnvelope;

function BasicEnvelope() {

}

Object.defineProperties(BasicEnvelope.prototype, {
  //Producer side functions
  getMessage: {
    value: function(data, kind) {
      return {
        properties: {
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