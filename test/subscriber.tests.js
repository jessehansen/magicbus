'use strict';

var Subscriber = require('../lib/subscriber');

var EventDispatcher = require('../lib/event-dispatcher');
var Logger = require('../lib/logger');
var EventEmitter = require('events').EventEmitter;

var chai = require('chai');
var expect = chai.expect;

var sinon = require('sinon');
var sinonChai = require('sinon-chai');
chai.use(sinonChai);

chai.use(require('chai-as-promised'));

describe('Subscriber', function() {
  var mockReceiver;
  var eventDispatcher;
  var subscriber;
  var logger;
  var logs;

  beforeEach(function() {
    var logEvents = new EventEmitter();
    logs = [];
    logger = new Logger(logEvents);
    logEvents.on('log', function(data) {
      logs.push(data);
    });
    mockReceiver = {
      use: function(/* middleware */) {},
      startConsuming: function(handler) {
        this._handler = handler;
      }
    };
    eventDispatcher = new EventDispatcher();

    subscriber = new Subscriber(mockReceiver, eventDispatcher, logger);
  });

  describe('#on', function() {
    it('should pass through to the event dispatcher', function() {
      var eventName = 'myEvent',
        handler = function() {};
      eventDispatcher.on = sinon.spy();

      subscriber.on(eventName, handler);

      expect(eventDispatcher.on).to.have.been.calledWith(eventName, handler);
    });
  });

  describe('#use', function() {
    it('should pass through to the reciever', function() {
      var middleware = function() {};
      mockReceiver.use = sinon.spy();

      subscriber.use(middleware);

      expect(mockReceiver.use).to.have.been.calledWith(middleware);
    });
  });

  describe('#startSubscription', function() {
    var payload, messageTypes, msg;

    beforeEach(function() {
      payload = 'payload';
      messageTypes = ['type1', 'type2'];
      msg = {
        payload: payload,
        properties: {}
      };
    });

    it('should start the receiver', function() {
      mockReceiver.startConsuming = sinon.spy();

      subscriber.startSubscription();

      expect(mockReceiver.startConsuming).to.have.been.called;
    });

    it('should pass consumed events to the dispatcher', function() {
      var handler1 = sinon.spy();
      var handler2 = sinon.spy();

      eventDispatcher.on(messageTypes[0], handler1);
      eventDispatcher.on(messageTypes[1], handler2);

      subscriber.startSubscription();

      return mockReceiver._handler(payload, messageTypes, msg).then(function() {
        expect(handler1).to.have.been.calledWith(messageTypes[0], payload, msg);
        expect(handler2).to.have.been.calledWith(messageTypes[1], payload, msg);
      });
    });

    it('should fail given synchronous handler fails', function() {
      eventDispatcher.on(messageTypes[0], function(){
        throw new Error('Something happened');
      });

      subscriber.startSubscription();
      return expect(mockReceiver._handler(payload, messageTypes, msg)).to.eventually.be.rejectedWith('Something happened')
        .then(function(){
          expect(logs[logs.length-1].err).to.be.ok;
        });
    });

    it('should fail given no handler is registered for the message type', function() {
      subscriber.startSubscription();
      return expect(mockReceiver._handler(payload, messageTypes, msg)).to.eventually.be.rejectedWith('No handler registered');
    });

    it('should fail given async handler fails', function() {
      eventDispatcher.on(messageTypes[0], function(){
        return Promise.reject(new Error('Something happened'));
      });

      subscriber.startSubscription();
      return expect(mockReceiver._handler(payload, messageTypes, msg)).to.eventually.be.rejectedWith('Something happened')
        .then(function(){
          expect(logs[logs.length-1].err).to.be.ok;
        });
    });

  });

});
