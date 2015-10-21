'use strict';

var Publisher = require('../lib/publisher.js');

var chai = require('chai');
var expect = chai.expect;

var sinon = require('sinon');
var sinonChai = require('sinon-chai');
chai.use(sinonChai);

chai.use(require('chai-as-promised'));

var BasicEnvelope = require('../lib/basic-envelope.js');
var JsonSerializer = require('../lib/json-serializer.js');
var PublisherRoutePattern = require('../lib/route-patterns/publisher-route-pattern.js');

var Promise = require('bluebird');

describe('Publisher', function() {
  var mockBroker;

  beforeEach(function() {
    mockBroker = {
      registerRoute: function(name, pattern) {},
      publish: function(eventName, data) {
        return Promise.resolve();
      }
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

    it('should use the publisher route pattern with a topic exchange type', function() {
      expect(publisher.route.pattern instanceof PublisherRoutePattern).to.eq(true);
      expect(publisher.route.pattern.exchangeType).to.eq('topic');
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
      var pattern = {};

      var publisher = new Publisher(mockBroker, {
        routePattern: pattern
      });

      expect(publisher.route.pattern).to.eq(pattern);
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

      var pattern = {};
      new Publisher(mockBroker, {
        routePattern: pattern
      });
      expect(mockBroker.registerRoute).to.have.been.calledWith('publish', pattern);
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

  describe('publish', function() {
    var publisher;

    beforeEach(function() {
      publisher = new Publisher(mockBroker);
    });

    it('should be rejected with an assertion error given no event name', function() {
      var p = publisher.publish();

      return expect(p).to.be.rejectedWith('eventName (string) is required');
    });

    it('should be fulfilled given the broker.publish call is fulfilled', function() {
      var brokerPromise = Promise.resolve();

      mockBroker.publish = function() {
        return brokerPromise;
      };

      var p = publisher.publish('something-happened');

      return expect(p).to.be.fulfilled;
    });

    it('should be rejected given the broker.publish call is rejected', function() {
      var brokerPromise = Promise.reject(new Error('Aw, snap!'));

      mockBroker.publish = function() {
        return brokerPromise;
      };

      var p = publisher.publish('something-happened');

      return expect(p).to.be.rejectedWith('Aw, snap!');
    });
  });
});
