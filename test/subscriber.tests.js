'use strict';

var Subscriber = require('../lib/subscriber.js');

var chai = require('chai');
var expect = chai.expect;

var sinon = require('sinon');
var sinonChai = require('sinon-chai');
chai.use(sinonChai);

var BasicEnvelope = require('../lib/basic-envelope.js');
var JsonSerializer = require('../lib/json-serializer.js');

describe('Subscriber', function() {
  var mockBroker;

  beforeEach(function() {
    mockBroker = {
      registerRoute: function(name, pattern) {},
      ack: function(routeName, message) {},
      nack: function(routeName, message) {}
    };
  });

  describe('default construction', function() {
    var subscriber;

    beforeEach(function() {
      subscriber = new Subscriber(mockBroker);
    });

    it('should use subscribe as the route name', function() {
      expect(subscriber.route.name).to.eq('subscribe');
    });

    it('should use worker as the route pattern', function() {
      expect(subscriber.route.pattern).to.eq('worker');
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

    it('should use the route pattern passed in the options', function() {
      var subscriber = new Subscriber(mockBroker, {
        routePattern: 'listener'
      });

      expect(subscriber.route.pattern).to.eq('listener');
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

  describe('constructor broker wireup', function() {
    it('should register a route with the broker', function() {
      sinon.spy(mockBroker, 'registerRoute');
      new Subscriber(mockBroker);
      expect(mockBroker.registerRoute).to.have.been.calledWith('subscribe', 'worker');
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

  describe('acknowledging messages based on handler results', function() {
    var eventName;
    var fakeMessage;

    beforeEach(function() {
      //The fake message needs to be real enough to thread the needle through the 
      //envelope, serialization, and dispatch parts of the pipeline
      eventName = 'my-event';
      fakeMessage = {
        properties: {
          type: eventName
        },
        content: new Buffer(JSON.stringify('the payload'))
      };

      //subscriber.startSubscription() will call this to register the subsriber's consume
      //callback with the broker. We'll asynchronously call the subscriber's consume
      //callback with our fake message
      mockBroker.consume = function(routeName, callback, options) {
        process.nextTick(function() {
          callback(fakeMessage);
        });
      };
    });

    it('should ack messages given the synchronous handler does not throw', function(done) {
      var handler = function(handlerEventName, handlerData) {
        //Not throwing an exception here
      };

      //This is our assertion. The subscriber's consume callback should call this
      //with the message we gave it. If it doesn't, the test will fail with a
      //timeout
      mockBroker.ack = function(routeName, message) {
        expect(routeName).to.eq(subscriber.route.name);
        expect(message).to.eq(fakeMessage);
        done();
      };

      var subscriber = new Subscriber(mockBroker);
      subscriber.on(eventName, handler);
      subscriber.startSubscription();
    });

    it('should nack messages given the synchronous handler throws', function(done) {
      var handler = function(handlerEventName, handlerData) {
        throw new Error('Aw, snap!');
      };

      //This is our assertion. The subscriber's consume callback should call this
      //with the message we gave it. If it doesn't, the test will fail with a
      //timeout
      mockBroker.nack = function(routeName, message, allUpTo, requeue) {
        expect(routeName).to.eq(subscriber.route.name);
        expect(message).to.eq(fakeMessage);
        expect(allUpTo).to.eq(false);
        expect(requeue).to.eq(false);

        done();
      };

      var subscriber = new Subscriber(mockBroker);
      subscriber.on(eventName, handler);
      subscriber.startSubscription();
    });
  });

  describe('dealing with unhandled messages', function() {
    var eventName;
    var fakeMessage;

    beforeEach(function() {
      //The fake message needs to be real enough to thread the needle through the 
      //envelope, serialization, and dispatch parts of the pipeline
      eventName = 'my-event';
      fakeMessage = {
        properties: {
          type: eventName
        },
        content: new Buffer(JSON.stringify('the payload'))
      };

      //subscriber.startSubscription() will call this to register the subsriber's consume
      //callback with the broker. We'll asynchronously call the subscriber's consume
      //callback with our fake message
      mockBroker.consume = function(routeName, callback, options) {
        process.nextTick(function() {
          callback(fakeMessage);
        });
      };
    });

    it('should nack messages given no handler is registered for the message type', function(done) {
      //This is our assertion. The subscriber's consume callback should call this
      //with the message we gave it. If it doesn't, the test will fail with a
      //timeout
      mockBroker.nack = function(routeName, message, allUpTo, requeue) {
        expect(routeName).to.eq(subscriber.route.name);
        expect(message).to.eq(fakeMessage);
        expect(allUpTo).to.eq(false);
        expect(requeue).to.eq(false);

        done();
      };

      var subscriber = new Subscriber(mockBroker);
      //Not registering any handlers before starting the subscription
      subscriber.startSubscription();
    });

    it('should nack messages given more than one handler is registered for the message type', function(done) {
      //This is our assertion. The subscriber's consume callback should call this
      //with the message we gave it. If it doesn't, the test will fail with a
      //timeout
      mockBroker.nack = function(routeName, message, allUpTo, requeue) {
        expect(routeName).to.eq(subscriber.route.name);
        expect(message).to.eq(fakeMessage);
        expect(allUpTo).to.eq(false);
        expect(requeue).to.eq(false);

        done();
      };

      var subscriber = new Subscriber(mockBroker);
      //Registering multiple handlers for the message
      subscriber.on(eventName, function(){});
      subscriber.on(eventName, function(){});
      subscriber.startSubscription();
    });
  });
});