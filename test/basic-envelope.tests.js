'use strict';

var BasicEnvelope = require('../lib/basic-envelope.js');

var chai = require('chai');
var expect = chai.expect;

describe('BasicEnvelope', function() {
  var envelope;

  beforeEach(function() {
    envelope = new BasicEnvelope();
  });

  describe('getMessage', function() {
    it('should put the kind of the message in the type property of the amqp properties', function() {
      var msg = envelope.getMessage({
        my: 'data'
      }, 'my-kind');

      expect(msg.properties.type).to.eq('my-kind');
    });

    it('should put the data of the message in the payload', function() {
      var msg = envelope.getMessage({
        my: 'data'
      }, 'my-kind');

      var expected = {
        my: 'data'
      };
      expect(msg.payload).to.eql(expected);
    });
  });

  describe('getData', function() {
    it('should return the payload given a message with a payload', function() {
      var msg = {
        payload: {
          my: 'data'
        }
      };

      var data = envelope.getData(msg);

      var expected = {
        my: 'data'
      };
      expect(data).to.eql(expected);
    });

    it('should return null given a message with no payload', function() {
      var msg = {};

      var data = envelope.getData(msg);

      expect(data).to.eq(null);
    });

    it('should throw an assertion error given no message', function() {
      var fn = function() {
        envelope.getData();
      };

      expect(fn).to.throw('AssertionError: message (object) is required');
    });
  });

  describe('getMessageTypes', function() {
    it('should return the type property of the amqp properties as the only message type given a message with a type', function() {
      var msg = {
        properties: {
          type: 'my-kind'
        }
      };

      var messageTypes = envelope.getMessageTypes(msg);

      expect(messageTypes).to.eql(['my-kind']);
    });

    it('should return an empty array given a message with no type', function() {
      var msg = {};

      var messageTypes = envelope.getMessageTypes(msg);

      expect(messageTypes).to.eql([]);
    });

    it('should throw an assertion error given no message', function() {
      var fn = function() {
        envelope.getMessageTypes();
      };

      expect(fn).to.throw('AssertionError: message (object) is required');
    });
  });
});