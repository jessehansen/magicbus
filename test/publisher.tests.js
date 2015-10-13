'use strict';

var Publisher = require('../lib/publisher.js');

var chai = require('chai');
var expect = chai.expect;

var BasicEnvelope = require('../lib/basic-envelope.js');
var JsonSerializer = require('../lib/json-serializer.js');

describe('Publisher', function() {
  var mockBroker;

  beforeEach(function() {
    mockBroker = {};
  });

  describe('default construction', function() {
    var publisher;

    beforeEach(function() {
      publisher = new Publisher(mockBroker);
    });

    it('should use publish as the route name', function() {
      expect(publisher.route.name).to.eq('publish');
    });

    it('should use the basic envelope', function() {
      expect(publisher._envelope instanceof BasicEnvelope).to.eq(true);
    });

    it('should use the json serializer', function() {
      expect(publisher._serializer instanceof JsonSerializer).to.eq(true);
    });

    it('should not use a routing key prefix', function() {
      expect(publisher._defaultRoutingKeyPrefix).to.not.be.ok;
    });
  });

  describe('construction options', function() {
    it('should use the route name passed in the options', function() {
      var publisher = new Publisher(mockBroker, {
        routeName: 'my-route'
      });

      expect(publisher.route.name).to.eq('my-route');
    });

    it('should use the envelope passed in the options', function() {
      var envelope = {};
      var publisher = new Publisher(mockBroker, {
        envelope: envelope
      });

      expect(publisher._envelope).to.eq(envelope);
    });

    it('should use the serializer passed in the options', function() {
      var serializer = {};
      var publisher = new Publisher(mockBroker, {
        serializer: serializer
      });

      expect(publisher._serializer).to.eq(serializer);
    });

    it('should use the routing key prefix passed in the options', function() {
      var publisher = new Publisher(mockBroker, {
        routingKeyPrefix: 'my-entity'
      });

      expect(publisher._defaultRoutingKeyPrefix).to.eq('my-entity');
    });
  });

  describe('constructor argument checking', function() {
    it('should throw an assertion error given no broker', function() {
      var fn = function() {
        new Publisher();
      };

      expect(fn).to.throw('AssertionError: broker (object) is required');
    });
  });
});