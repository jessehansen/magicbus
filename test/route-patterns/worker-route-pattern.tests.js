'use strict';

var WorkerRoutePattern = require('../../lib/route-patterns/worker-route-pattern.js');

var chai = require('chai');
var expect = chai.expect;

var sinon = require('sinon');
var sinonChai = require('sinon-chai');
chai.use(sinonChai);

chai.use(require('chai-as-promised'));

var Promise = require('bluebird');

describe('WorkerRoutePattern', function() {
  describe('assertRoute', function() {
    var mockChannel;
    var routePattern;

    beforeEach(function() {
      mockChannel = {
        assertExchange: function() {
          return Promise.resolve();
        },
        assertQueue: function() {
          return Promise.resolve();
        },
        bindQueue: function() {
          return Promise.resolve();
        }
      };

      routePattern = new WorkerRoutePattern();
    });

    it('should assert a dead letter exchange', function() {
      sinon.spy(mockChannel, 'assertExchange');

      return routePattern.assertRoute('my-domain', 'my-app', 'my-route', mockChannel).then(function(){
        expect(mockChannel.assertExchange).to.have.been.calledWith('my-domain.my-app.my-route.failed', 'fanout', {durable: true});
      });
    });

    it('should assert a queue to hold failed messages', function() {
      sinon.spy(mockChannel, 'assertQueue');

      return routePattern.assertRoute('my-domain', 'my-app', 'my-route', mockChannel).then(function(){
        expect(mockChannel.assertQueue).to.have.been.calledWith('my-domain.my-app.my-route.failed');
      });
    });

    it('should bind the failed message queue to the dead letter exchange', function() {
      sinon.spy(mockChannel, 'bindQueue');

      return routePattern.assertRoute('my-domain', 'my-app', 'my-route', mockChannel).then(function(){
        expect(mockChannel.bindQueue).to.have.been.calledWith('my-domain.my-app.my-route.failed', 'my-domain.my-app.my-route.failed', '');
      });
    });

    it('should assert the queue to consume from and connect it to the dead letter exchange', function() {
      sinon.spy(mockChannel, 'assertQueue');

      return routePattern.assertRoute('my-domain', 'my-app', 'my-route', mockChannel).then(function(){
        expect(mockChannel.assertQueue).to.have.been.calledWith('my-domain.my-app.my-route', {deadLetterExchange: 'my-domain.my-app.my-route.failed'});
      });
    });

    it('should return the name of the queue to consume from', function() {
      var p = routePattern.assertRoute('my-domain', 'my-app', 'my-route', mockChannel);

      return expect(p).to.eventually.eql({queueName: 'my-domain.my-app.my-route'});
    });

    it('should reject if any of the topology cannot be created', function() {
      mockChannel.assertQueue = function() {
        return Promise.reject(new Error('Nuts!'));
      };

      var p = routePattern.assertRoute('my-domain', 'my-app', 'my-route', mockChannel);

      return expect(p).to.be.rejectedWith('Nuts!');
    });
  });
});