'use strict';

var Sender = require('../lib/sender.js');

var chai = require('chai');
var expect = chai.expect;

var sinon = require('sinon');
var sinonChai = require('sinon-chai');
chai.use(sinonChai);

chai.use(require('chai-as-promised'));

var BasicEnvelope = require('../lib/basic-envelope.js');

var Promise = require('bluebird');

describe('Sender', function() {
  var mockBroker;

  beforeEach(function() {
    mockBroker = {
      registerRoute: function(/* name, pattern */) {},
      publish: function(/* eventName, data */) {
        return Promise.resolve();
      }
    };
  });

  describe('default construction', function() {
    var sender;

    beforeEach(function() {
      sender = new Sender(mockBroker);
    });

    it('should use the basic envelope', function() {
      expect(sender._envelope instanceof BasicEnvelope).to.eq(true);
    });
  });

  describe('construction options', function() {
    it('should use the route name passed in the options', function() {
      var sender = new Sender(mockBroker, {
        routeName: 'my-route'
      });

      expect(sender._routeName).to.eq('my-route');
    });

    it('should use the route pattern passed in the options', function() {
      var pattern = {};

      var sender = new Sender(mockBroker, {
        routePattern: pattern
      });

      expect(sender._routePattern).to.eq(pattern);
    });

    it('should use the envelope passed in the options', function() {
      var envelope = {};
      var sender = new Sender(mockBroker, {
        envelope: envelope
      });

      expect(sender._envelope).to.eq(envelope);
    });
  });

  describe('constructor argument checking', function() {
    it('should throw an assertion error given no broker', function() {
      var fn = function() {
        new Sender();
      };

      expect(fn).to.throw('AssertionError: broker (object) is required');
    });
  });

  describe('send', function() {
    var sender;
    var msg;

    beforeEach(function() {
      sender = new Sender(mockBroker);
      msg = {'some':'data'};
    });

    it('should register a route with the broker', function() {
      sinon.spy(mockBroker, 'registerRoute');

      var pattern = {};
      return new Sender(mockBroker, {
        routePattern: pattern
      }).send({hi:'world'}).then(function(){
        expect(mockBroker.registerRoute).to.have.been.calledWith('send', pattern);
      });
    });

    it('should be rejected with an assertion error given no message', function() {
      var fn = function(){
        sender.send();
      };

      expect(fn).to.throw('message (object) is required');
    });

    it('should be fulfilled given the broker.publish call is fulfilled', function() {
      mockBroker.publish = function() {
        return Promise.resolve();
      };

      var p = sender.send(msg);

      return expect(p).to.be.fulfilled;
    });

    it('should be rejected given the broker.publish call is rejected', function() {
      var brokerPromise = Promise.reject(new Error('Aw, snap!'));

      mockBroker.publish = function() {
        return brokerPromise;
      };

      var p = sender.send(msg);

      return expect(p).to.be.rejectedWith('Aw, snap!');
    });

    it('should be rejected when middleware rejects the message', function() {
      sender.use(function(message, actions) {
        actions.error(new Error('Aw, snap!'));
      });

      var p = sender.send(msg);

      return expect(p).to.eventually.be.rejectedWith('Aw, snap!');
    });

    it('should call middleware with the message', function() {
      var middlewareCalled = false;
      sender.use(function(message, actions){
        middlewareCalled = true;
        actions.next();
      });

      var p = sender.send(msg);

      return p.then(function() {
          expect(middlewareCalled).to.equal(true);
        });
    });
  });
});
