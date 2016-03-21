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
  describe('createTopology', function() {
    var mockTopology;
    var routePattern;

    beforeEach(function() {
      mockTopology = {
        createQueue: function() {
          return Promise.resolve();
        },
        createExchange: function() {
          return Promise.resolve();
        },
        createBinding: function() {
          return Promise.resolve();
        }
      };

      routePattern = new ListenerRoutePattern();
    });

    it('should createTopology a fanout exchange with a conventional name', function() {
      sinon.spy(mockTopology, 'createExchange');

      return routePattern.createTopology(mockTopology, 'my-domain', 'my-app', 'my-route').then(function(){
        expect(mockTopology.createExchange).to.have.been.calledWith({
          name: 'my-domain.my-app.my-route',
          type: 'fanout',
          durable: true
        });
      });
    });

    it('should createTopology an exclusive temporary queue with a random name', function() {
      sinon.spy(mockTopology, 'createQueue');

      return routePattern.createTopology(mockTopology, 'my-domain', 'my-app', 'my-route').then(function(){
        expect(mockTopology.createQueue).to.have.been.calledWith(sinon.match({
          name: sinon.match(/my-domain.my-app.my-route.listener-\.*/),
          exclusive: true,
          durable: false
        }));
      });
    });

    it('should bind the temporary queue to the fanout exchange', function() {
      sinon.spy(mockTopology, 'createBinding');

      return routePattern.createTopology(mockTopology, 'my-domain', 'my-app', 'my-route').then(function(){
        expect(mockTopology.createBinding).to.have.been.calledWith(sinon.match({
          target: sinon.match(/my-domain.my-app.my-route.listener-\.*/),
          source: 'my-domain.my-app.my-route'
        }));
      });
    });

    it('should return the name of the queue to consume from', function() {
      var p = routePattern.createTopology(mockTopology, 'my-domain', 'my-app', 'my-route');

      return expect(p).to.eventually.satisfy(function(result) {
        return /my-domain.my-app.my-route.listener-\.*/.test(result.queueName);
      });
    });

    it('should reject if any of the topology cannot be created', function() {
      mockTopology.createQueue = function() {
        return Promise.reject(new Error('Nuts!'));
      };

      var p = routePattern.createTopology(mockTopology, 'my-domain', 'my-app', 'my-route');

      return expect(p).to.be.rejectedWith('Nuts!');
    });
  });
});
