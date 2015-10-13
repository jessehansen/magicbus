'use strict';

var Subscriber = require('../lib/subscriber.js');

var chai = require('chai');
var expect = chai.expect;

var BasicEnvelope = require('../lib/basic-envelope.js');
var JsonSerializer = require('../lib/json-serializer.js');

describe('Subscriber', function() {
  var mockBroker;

  beforeEach(function() {
    mockBroker = {};
  });

  describe('default construction', function() {
    var subscriber;

    beforeEach(function() {
      subscriber = new Subscriber(mockBroker);
    });

    it('should use subscribe as the route name', function() {
      expect(subscriber.route.name).to.eq('subscribe');
    });

    it('should use the basic envelope', function() {
      expect(subscriber._envelope instanceof BasicEnvelope).to.eq(true);
    });

    it('should use the json serializer', function() {
      expect(subscriber._serializer instanceof JsonSerializer).to.eq(true);
    });
  });

  describe('construction options', function() {
    it('should use the route name passed in the options', function() {
      var subscriber = new Subscriber(mockBroker, {
        routeName: 'my-route'
      });

      expect(subscriber.route.name).to.eq('my-route');
    });

    it('should use the envelope passed in the options', function() {
      var envelope = {};
      var subscriber = new Subscriber(mockBroker, {
        envelope: envelope
      });

      expect(subscriber._envelope).to.eq(envelope);
    });

    it('should use the serializer passed in the options', function() {
      var serializer = {};
      var subscriber = new Subscriber(mockBroker, {
        serializer: serializer
      });

      expect(subscriber._serializer).to.eq(serializer);
    });
  });

  describe('constructor argument checking', function() {
    it('should throw an assertion error given no broker', function() {
      var fn = function() {
        new Subscriber();
      };

      expect(fn).to.throw('AssertionError: broker (object) is required');
    });
  });
});