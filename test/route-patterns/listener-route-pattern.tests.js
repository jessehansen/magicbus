'use strict';

var ListenerRoutePattern = require('../../lib/route-patterns/listener-route-pattern.js');

var chai = require('chai');
var expect = chai.expect;

var sinon = require('sinon');
var sinonChai = require('sinon-chai');
chai.use(sinonChai);

chai.use(require('chai-as-promised'));

var Promise = require('bluebird');

describe('ListenerRoutePattern', function() {
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

      routePattern = new ListenerRoutePattern();
    });

    it('should assert a fanout exchange with a conventional name', function() {
      sinon.spy(mockChannel, 'assertExchange');

      return routePattern.assertRoute('my-domain', 'my-app', 'my-route', mockChannel).then(function(){
        expect(mockChannel.assertExchange).to.have.been.calledWith('my-domain.my-app.my-route', 'fanout', {durable: true});
      });
    });

    it('should assert an exclusive temporary queue with a random name', function() {
      sinon.spy(mockChannel, 'assertQueue');

      return routePattern.assertRoute('my-domain', 'my-app', 'my-route', mockChannel).then(function(){
        expect(mockChannel.assertQueue).to.have.been.calledWith(sinon.match(/my-domain.my-app.my-route.listener-\.*/), {exclusive: true, durable: false});
      });
    });

    it('should bind the temporary queue to the fanout exchange', function() {
      sinon.spy(mockChannel, 'bindQueue');

      return routePattern.assertRoute('my-domain', 'my-app', 'my-route', mockChannel).then(function(){
        expect(mockChannel.bindQueue).to.have.been.calledWith(sinon.match(/my-domain.my-app.my-route.listener-\.*/), 'my-domain.my-app.my-route', '');
      });
    });

    it('should return the name of the queue to consume from', function() {
      var p = routePattern.assertRoute('my-domain', 'my-app', 'my-route', mockChannel);

      return expect(p).to.eventually.satisfy(function(result) {
        return /my-domain.my-app.my-route.listener-\.*/.test(result.queueName);
      });
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