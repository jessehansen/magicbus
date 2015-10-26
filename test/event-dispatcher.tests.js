'use strict';

var EventDispatcher = require('../lib/event-dispatcher');

var chai = require('chai');
var expect = chai.expect;

var sinon = require('sinon');
var sinonChai = require('sinon-chai');
chai.use(sinonChai);

var eventName = 'myCoolEventName';
var reallyBadEventName = '/\\^$*+?.()|[]{}';

describe.only('EventDispatcher', function() {
  var doNothing = function() {};
  var eventDispatcher;
  var handlerSpy;
  var arg1 = {};
  var arg2 = [];
  var arg3 = 'primitive';

  beforeEach(function() {
    eventDispatcher = new EventDispatcher();
    handlerSpy = sinon.spy();
  });

  describe('#on', function() {
    it('should not allow empty eventNames paramter', function() {
      expect(function() {
        eventDispatcher.on(null, doNothing);
      }).to.throw();
    });
    it('should not allow empty handler', function() {
      expect(function() {
        eventDispatcher.on('something', null);
      }).to.throw();
    });
    it('should not have trouble with strings containing regex special characters', function(){
      expect(function() {
        eventDispatcher.on(reallyBadEventName, doNothing);
      }).to.not.throw();
    });
  });

  describe('#dispatch', function() {
    it('should not allow no event name', function() {
      expect(function() { eventDispatcher.dispatch(''); }).to.throw();
      expect(function() { eventDispatcher.dispatch(null); }).to.throw();
    });
    it('should call handler when string event name matches event name exactly', function(){
      eventDispatcher.on(eventName, handlerSpy);
      eventDispatcher.dispatch(eventName);

      expect(handlerSpy).to.have.been.calledWith(eventName);
    });
    it('should not call handler when event name is a mismatch', function(){
      eventDispatcher.on(eventName, handlerSpy);
      eventDispatcher.dispatch('myColdEventName', arg1, arg2, arg3);

      expect(handlerSpy).to.have.not.been.called;
    });
    it('should call regex handlers whenever they match', function(){
      eventDispatcher.on(/my.*EventName/, handlerSpy);

      eventDispatcher.dispatch(eventName);
      expect(handlerSpy).to.have.been.calledWith(eventName);
    });
    it('should not call regex handlers they do not match', function(){
      eventDispatcher.on(/your.*EventName/, handlerSpy);

      eventDispatcher.dispatch(eventName);
      expect(handlerSpy).to.have.not.been.called;
    });
    it('should call handler registered with an array', function(){
      eventDispatcher.on([eventName, 'someOtherEventName'], handlerSpy);
      eventDispatcher.dispatch(eventName);

      expect(handlerSpy).to.have.been.calledWith(eventName);
    });
    it('should call multiple handlers', function(){
      var secondSpy = sinon.spy();
      eventDispatcher.on(eventName, handlerSpy);
      eventDispatcher.on(eventName, secondSpy);
      eventDispatcher.dispatch(eventName);

      expect(handlerSpy).to.have.been.calledWith(eventName);
      expect(secondSpy).to.have.been.calledWith(eventName);
    });
    it('should call handlers with arguments', function(){
      eventDispatcher.on(eventName, handlerSpy);
      eventDispatcher.dispatch(eventName, arg1, arg2, arg3);

      expect(handlerSpy).to.have.been.calledWith(eventName, arg1, arg2, arg3);
    });
  });
});
