'use strict';

var Publisher = require('../lib/publisher.js');

var chai = require('chai');
var expect = chai.expect;

var sinon = require('sinon');
var sinonChai = require('sinon-chai');
chai.use(sinonChai);

var BasicEnvelope = require('../lib/basic-envelope.js');
var JsonSerializer = require('../lib/json-serializer.js');

describe('Publisher', function() {
  var mockBroker;

  beforeEach(function() {
    mockBroker = {
      registerRoute: function(name, pattern) {}
    };
  });

  describe('default construction', function() {
    var publisher;

    beforeEach(function() {
      publisher = new Publisher(mockBroker);
    });

    it('should use publish as the route name', function() {
      expect(publisher.route.name).to.eq('publish');
    });

    it('should use topic-publisher as the route pattern', function() {
      expect(publisher.route.pattern).to.eq('topic-publisher');
    });

    it('should use the basic envelope', function() {
      expect(publisher._envelope instanceof BasicEnvelope).to.eq(true);
    });

    it('should use the json serializer', function() {
      expect(publisher._serializer instanceof JsonSerializer).to.eq(true);
    });
  });

  describe('construction options', function() {
    it('should use the route name passed in the options', function() {
      var publisher = new Publisher(mockBroker, {
        routeName: 'my-route'
      });

      expect(publisher.route.name).to.eq('my-route');
    });

    it('should use the route pattern passed in the options', function() {
      var publisher = new Publisher(mockBroker, {
        routePattern: 'headers-publisher'
      });

      expect(publisher.route.pattern).to.eq('headers-publisher');
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
  });

  describe('constructor broker wireup', function() {
    it('should register a route with the broker', function() {
      sinon.spy(mockBroker, 'registerRoute');
      new Publisher(mockBroker);
      expect(mockBroker.registerRoute).to.have.been.calledWith('publish', 'topic-publisher');
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