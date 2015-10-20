'use strict';

var PublisherRoutePattern = require('../../lib/route-patterns/publisher-route-pattern.js');

var chai = require('chai');
var expect = chai.expect;

var sinon = require('sinon');
var sinonChai = require('sinon-chai');
chai.use(sinonChai);

chai.use(require('chai-as-promised'));

var Promise = require('bluebird');

describe('PublisherRoutePattern', function() {
  describe('default construction', function() {
    var routePattern;

    beforeEach(function(){
      routePattern = new PublisherRoutePattern();
    });

    it('should use the topic exchange type', function() {
      expect(routePattern.exchangeType).to.eq('topic');
    });
  });

  describe('construction options', function() {
    it('should use the exchange type passed in the options', function() {
      var routePattern = new PublisherRoutePattern({
        exchangeType: 'headers'
      });

      expect(routePattern.exchangeType).to.eq('headers');
    });
  });

  describe('assertRoute', function() {
    var mockChannel;
    var routePattern;

    beforeEach(function() {
      mockChannel = {
        assertExchange: function() {
          return Promise.resolve();
        }
      };

      routePattern = new PublisherRoutePattern();
    });

    it('should assert an exchange with a conventional name and the specified type', function() {
      sinon.spy(mockChannel, 'assertExchange');

      return routePattern.assertRoute('my-domain', 'my-app', 'my-route', mockChannel).then(function(){
        expect(mockChannel.assertExchange).to.have.been.calledWith('my-domain.my-app.my-route', routePattern.exchangeType, {durable: true});
      });
    });

    it('should return the name of the exchange it created', function() {
      var p = routePattern.assertRoute('my-domain', 'my-app', 'my-route', mockChannel);

      return expect(p).to.eventually.eql({exchangeName: 'my-domain.my-app.my-route'});
    });

    it('should reject if the exchange cannot be created', function() {
      mockChannel.assertExchange = function() {
        return Promise.reject(new Error('Shoot!'));
      };

      var p = routePattern.assertRoute('my-domain', 'my-app', 'my-route', mockChannel);

      return expect(p).to.be.rejectedWith('Shoot!');
    });
  });
});