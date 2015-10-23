'use strict';

var Subscriber = require('../lib/subscriber.js');

var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

var sinon = require('sinon');
var sinonChai = require('sinon-chai');
chai.use(sinonChai);

var BasicEnvelope = require('../lib/basic-envelope.js');
var Promise = require('bluebird');

var WorkerRoutePattern = require('../lib/route-patterns/worker-route-pattern.js');

describe('Subscriber', function() {
  var mockBroker;

  beforeEach(function() {
    mockBroker = {
      registerRoute: function(/* name, pattern */) {},
      ack: function(/* routeName, message */) {},
      nack: function(/* routeName, message */) {}
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

    it('should use the worker route pattern', function() {
      expect(subscriber.route.pattern instanceof WorkerRoutePattern).to.eq(true);
    });

    it('should use the basic envelope', function() {
      expect(subscriber._envelope instanceof BasicEnvelope).to.eq(true);
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
      var pattern = {};
      var subscriber = new Subscriber(mockBroker, {
        routePattern: pattern
      });

      expect(subscriber.route.pattern).to.eq(pattern);
    });

    it('should use the envelope passed in the options', function() {
      var envelope = {};
      var subscriber = new Subscriber(mockBroker, {
        envelope: envelope
      });

      expect(subscriber._envelope).to.eq(envelope);
    });
  });

  describe('constructor broker wireup', function() {
    it('should register a route with the broker', function() {
      sinon.spy(mockBroker, 'registerRoute');

      var pattern = {};
      new Subscriber(mockBroker, {routePattern: pattern});
      expect(mockBroker.registerRoute).to.have.been.calledWith('subscribe', pattern);
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

    it('should ack the message given a synchronous handler that does not throw', function(done) {
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

    it('should nack the message given a synchronous handler that throws', function(done) {
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

    it('should ack the message after the handler has completed given an asynchronous handler that resolves successfully', function(done) {
      var handlerCompleted = false;
      var handler = function(handlerEventName, handlerData) {
        return new Promise(function(resolve, reject) {
          process.nextTick(function(){
            handlerCompleted = true;
            resolve();
          });
        });
      };

      //This is our assertion. The subscriber's consume callback should call this
      //with the message we gave it. If it doesn't, the test will fail with a
      //timeout
      mockBroker.ack = function(routeName, message) {
        expect(handlerCompleted).to.be.eq(true);
        expect(routeName).to.eq(subscriber.route.name);
        expect(message).to.eq(fakeMessage);

        done();
      };

      var subscriber = new Subscriber(mockBroker);
      subscriber.on(eventName, handler);
      subscriber.startSubscription();
    });

    it('should nack the message after the handler has completed given an asynchronous handler that rejects/resolves with an error', function(done) {
      var handlerCompleted = false;
      var handler = function(handlerEventName, handlerData) {
        return new Promise(function(resolve, reject) {
          process.nextTick(function(){
            handlerCompleted = true;
            reject(new Error('Aw, snap!'));
          });
        });
      };

      //This is our assertion. The subscriber's consume callback should call this
      //with the message we gave it. If it doesn't, the test will fail with a
      //timeout
      mockBroker.nack = function(routeName, message, allUpTo, requeue) {
        expect(handlerCompleted).to.be.eq(true);
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
      subscriber.on(eventName, function() {});
      subscriber.on(eventName, function() {});
      subscriber.startSubscription();
    });
  });

  describe('using middleware', function(){
    var eventName;
    var fakeMessage;

    beforeEach(function() {
      //The fake message needs to be real enough to thread the needle through the
      //envelope, serialization, and dispatch parts of the pipeline
      eventName = 'my-event';
      fakeMessage = {
        properties: {
          type: eventName,
          headers: []
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

    function ack(message, actions){
      actions.ack();
    }
    function nack(message, actions){
      actions.nack();
    }
    function reject(message, actions){
      actions.reject();
    }
    function modify(message, actions){
      message.payload += ' that is new';
      actions.next();
    }

    it('should call middleware when provided', function(done){
      var handlerCompleted = false;
      mockBroker.ack = function(routeName, message) {
        expect(handlerCompleted).to.be.eq(true);
        expect(routeName).to.eq(subscriber.route.name);
        expect(message).to.eq(fakeMessage);

        done();
      };

      var subscriber = new Subscriber(mockBroker);
      subscriber.use(modify);
      subscriber.on(eventName, function(eventName, message) {
        handlerCompleted = true;
        expect(message).to.equal('the payload that is new');
      });
      subscriber.startSubscription();

    });

    it('should ack when middleware calls ack', function(done){
      mockBroker.ack = function(routeName, message) {
        expect(routeName).to.eq(subscriber.route.name);
        expect(message).to.eq(fakeMessage);

        done();
      };

      var subscriber = new Subscriber(mockBroker);
      subscriber.use(ack);
      subscriber.on(eventName, function(/* message */) {
        assert.fail('Shouldn\'t receive any events when middleware acks');
      });
      subscriber.startSubscription();

    });

    it('should nack when middleware calls nack', function(done){
      mockBroker.nack = function(routeName, message, allUpTo, requeue) {
        expect(routeName).to.eq(subscriber.route.name);
        expect(message).to.eq(fakeMessage);
        expect(allUpTo).to.eq(false);
        expect(requeue).to.eq(true);

        done();
      };

      var subscriber = new Subscriber(mockBroker);
      subscriber.use(nack);
      subscriber.on(eventName, function(/* message */) {
        assert.fail('Shouldn\'t receive any events when middleware acks');
      });
      subscriber.startSubscription();

    });

    it('should nack when middleware calls reject', function(done){
      mockBroker.nack = function(routeName, message, allUpTo, requeue) {
        expect(routeName).to.eq(subscriber.route.name);
        expect(message).to.eq(fakeMessage);
        expect(allUpTo).to.eq(false);
        expect(requeue).to.eq(false);

        done();
      };

      var subscriber = new Subscriber(mockBroker);
      subscriber.use(reject);
      subscriber.on(eventName, function(/* message */) {
        assert.fail('Shouldn\'t receive any events when middleware acks');
      });
      subscriber.startSubscription();

    });

  });
});
