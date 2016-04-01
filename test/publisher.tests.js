'use strict';

var magicbus = require('../lib');
var Publisher = require('../lib/publisher');

var Promise = require('bluebird');
var Logger = require('@leisurelink/skinny-event-loggins');

var chai = require('chai');
var expect = chai.expect;

var sinon = require('sinon');
var sinonChai = require('sinon-chai');
chai.use(sinonChai);

chai.use(require('chai-as-promised'));

describe('Publisher', function() {
  var mockBroker;
  var logger;

  beforeEach(function() {
    mockBroker = {
      registerRoute: function(/* name, pattern */) {},
      publish: function(/* routeName, routingKey, content, options */) {
        return Promise.resolve();
      }
    };
    logger = Logger();
  });

  describe('constructor', function() {
    it('should throw an assertion error given no broker', function() {
      var fn = function() {
        Publisher();
      };

      expect(fn).to.throw('AssertionError: broker (object) is required');
    });
    it('should throw an assertion error given no envelope', function() {
      var fn = function() {
        Publisher(mockBroker);
      };

      expect(fn).to.throw('AssertionError: envelope (object) is required');
    });
    it('should throw an assertion error given no pipeline', function() {
      var fn = function() {
        Publisher(mockBroker, {});
      };

      expect(fn).to.throw('AssertionError: pipeline (object) is required');
    });
    it('should throw an assertion error given no routeName', function() {
      var fn = function() {
        Publisher(mockBroker, {}, {});
      };

      expect(fn).to.throw('AssertionError: routeName (string) is required');
    });
    it('should throw an assertion error given no routePattern', function() {
      var fn = function() {
        Publisher(mockBroker, {}, {}, 'route');
      };

      expect(fn).to.throw('AssertionError: routePattern (object) is required');
    });
    it('should throw an assertion error given no logger', function() {
      var fn = function() {
        Publisher(mockBroker, {}, {}, 'route', {});
      };

      expect(fn).to.throw('AssertionError: logger (object) is required');
    });
    it('should register a route with the broker', function() {
      var pattern = {};
      sinon.spy(mockBroker, 'registerRoute');

      Publisher(mockBroker, {}, {}, 'route', pattern, logger);
      expect(mockBroker.registerRoute).to.have.been.calledWith('route', pattern);
    });
  });

  describe('publish', function() {
    var publisher;

    beforeEach(function() {
      publisher = magicbus.createPublisher(mockBroker);
    });

    it('should register a route with the broker', function() {
      var pattern = {};
      sinon.spy(mockBroker, 'registerRoute');

      publisher = magicbus.createPublisher(mockBroker, function (cfg) {
        cfg.useRouteName('publish');
        cfg.useRoutePattern(pattern);
      });

      expect(mockBroker.registerRoute).to.have.been.calledWith('publish', pattern);
    });

    it('should be rejected with an assertion error given no event name', function() {
      var fn = function(){
        publisher.publish();
      };

      expect(fn).to.throw('eventName (string) is required');
    });

    it('should be fulfilled given the broker.publish calls are fulfilled', function() {
      mockBroker.publish = function() {
        return Promise.resolve();
      };

      return expect(publisher.publish('something-happened')).to.be.fulfilled;
    });

    it('should be rejected given the broker.publish call is rejected', function() {
      var brokerPromise = Promise.reject(new Error('Aw, snap!'));

      mockBroker.publish = function() {
        return brokerPromise;
      };

      return expect(publisher.publish('something-happened')).to.be.rejectedWith('Aw, snap!');
    });

    it('should be rejected given the middleware rejects the message', function() {
      publisher.use(function(message, actions){
        actions.error(new Error('Aw, snap!'));
      });

      return expect(publisher.publish('something-happened')).to.be.rejectedWith('Aw, snap!');
    });

    it('should call middleware with the message', function() {
      var middlewareCalled = false;
      publisher.use(function(message, actions){
        middlewareCalled = true;
        actions.next();
      });

      return publisher.publish('something-happened').then(function() {
        expect(middlewareCalled).to.equal(true);
      });
    });

    it('should set persistent to true by default', function() {
      sinon.spy(mockBroker, 'publish');

      return publisher.publish('something-happened').then(function(){
        expect(mockBroker.publish).to.have.been.calledWith('publish', sinon.match({ routingKey: 'something-happened', payload: null, persistent: true }));
      });
    });

    it('should copy properties from the properties property of the message to the publish options', function() {
      sinon.spy(mockBroker, 'publish');

      return publisher.publish('something-happened').then(function(){
        expect(mockBroker.publish).to.have.been.calledWith('publish', sinon.match({ routingKey: 'something-happened', payload: null, type: 'something-happened' }));
      });
    });

    it('should copy properties from the publishOptions property of the options to the publish options', function() {
      var options = {
        publishOptions: {
          correlationId: '123'
        }
      };

      sinon.spy(mockBroker, 'publish');

      return publisher.publish('something-happened', null, options).then(function(){
        expect(mockBroker.publish).to.have.been.calledWith('publish', sinon.match({ routingKey: 'something-happened', payload: null, correlationId: '123' }));
      });
    });

    it('should overwrite publish options set from anywhere else with values from the publishOptions property of the options', function() {
      var options = {
        publishOptions: {
          persistent: false
        }
      };

      sinon.spy(mockBroker, 'publish');

      return publisher.publish('something-happened', null, options).then(function(){
        expect(mockBroker.publish).to.have.been.calledWith('publish', sinon.match({ routingKey: 'something-happened', payload: null, persistent: false }));
      });
    });
  });
});
