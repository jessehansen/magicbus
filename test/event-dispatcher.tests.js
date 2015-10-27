'use strict';

var EventDispatcher = require('../lib/event-dispatcher');

var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

var sinon = require('sinon');
var sinonChai = require('sinon-chai');
chai.use(sinonChai);

chai.use(require('chai-as-promised'));

var eventName = 'myCoolEventName';
var reallyBadEventName = '/\\^$*+?.()|[]{}';

describe('EventDispatcher', function() {
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
    it('should not have trouble with strings containing regex special characters', function() {
      expect(function() {
        eventDispatcher.on(reallyBadEventName, doNothing);
      }).to.not.throw();
    });
  });

  describe('#dispatch', function() {
    it('should not allow no event name', function() {
      expect(function() {
        eventDispatcher.dispatch(null);
      }).to.throw();
      expect(function() {
        eventDispatcher.dispatch([]);
      }).to.throw();
      expect(function() {
        eventDispatcher.dispatch('');
      }).to.throw();
    });
    it('should call handler when string event name matches event name exactly', function() {
      eventDispatcher.on(eventName, handlerSpy);
      return eventDispatcher.dispatch(eventName).then(function(result) {
        expect(result).to.equal(true);
        expect(handlerSpy).to.have.been.calledWith(eventName);
      });
    });
    it('should not call handler when event name is a mismatch', function() {
      eventDispatcher.on(eventName, handlerSpy);
      expect(eventDispatcher.dispatch('myColdEventName', arg1, arg2, arg3)).to.eventually.equal(false);
    });
    it('should call regex handlers whenever they match', function() {
      eventDispatcher.on(/my.*EventName/, handlerSpy);

      return eventDispatcher.dispatch(eventName).then(function(result) {
        expect(result).to.equal(true);
        expect(handlerSpy).to.have.been.calledWith(eventName);
      });
    });
    it('should not call regex handlers they do not match', function() {
      eventDispatcher.on(/your.*EventName/, handlerSpy);

      expect(eventDispatcher.dispatch(eventName)).to.eventually.equal(false);
    });
    it('should call handler registered with an array', function() {
      eventDispatcher.on([eventName, 'someOtherEventName'], handlerSpy);

      return eventDispatcher.dispatch(eventName).then(function(result) {
        expect(result).to.equal(true);
        expect(handlerSpy).to.have.been.calledWith(eventName);
      });
    });
    it('should call multiple handlers', function() {
      var secondSpy = sinon.spy();
      eventDispatcher.on(eventName, handlerSpy);
      eventDispatcher.on(eventName, secondSpy);

      return eventDispatcher.dispatch(eventName).then(function(result) {
        expect(result).to.equal(true);
        expect(handlerSpy).to.have.been.calledWith(eventName);
        expect(secondSpy).to.have.been.calledWith(eventName);
      });
    });
    it('should call handlers with arguments', function() {
      eventDispatcher.on(eventName, handlerSpy);

      return eventDispatcher.dispatch(eventName, arg1, arg2, arg3).then(function(result) {
        expect(result).to.equal(true);
        expect(handlerSpy).to.have.been.calledWith(eventName, arg1, arg2, arg3);
      });
    });
    it('should call handlers when multiple event types are passed', function() {
      var secondSpy = sinon.spy();
      eventDispatcher.on(eventName, handlerSpy);
      eventDispatcher.on('myColdEventName', secondSpy);

      return eventDispatcher.dispatch([eventName, 'myColdEventName'], arg1, arg2, arg3).then(function(result) {
        expect(result).to.equal(true);
        expect(handlerSpy).to.have.been.calledWith(eventName, arg1, arg2, arg3);
        expect(secondSpy).to.have.been.calledWith('myColdEventName', arg1, arg2, arg3);
      });
    });

    describe('error handling', function() {
      it('should not call successive handlers after a failing synchronous handler', function() {
        eventDispatcher.on(eventName, doNothing);
        eventDispatcher.on(eventName, function(){
          throw new Error('my bad');
        });
        eventDispatcher.on(eventName, handlerSpy);

        return eventDispatcher.dispatch(eventName).then(function() {
          assert.fail();
        })
        .catch(function(err) {
          expect(err).to.be.ok;
          expect(handlerSpy).to.have.not.been.called;
        });
      });
      it('should not call successive handlers after a failing async handler', function() {
        eventDispatcher.on(eventName, doNothing);
        eventDispatcher.on(eventName, function(){
          return Promise.reject(new Error('my bad'));
        });
        eventDispatcher.on(eventName, handlerSpy);

        return eventDispatcher.dispatch(eventName).then(function() {
          assert.fail();
        })
        .catch(function(err) {
          expect(err).to.be.ok;
          expect(handlerSpy).to.have.not.been.called;
        });
      });
    });
  });
});
