'use strict';

var Broker = require('../').Broker;
var environment = require('./_test-env');

var chai = require('chai');
var expect = chai.expect;

var PublisherRoutePattern = require('../').RoutePatterns.Publisher;
var WorkerRoutePattern = require('../').RoutePatterns.Worker;

describe('Broker really using RabbitMQ', function() {
  var serviceDomainName = 'magicbus';
  var appName = 'tests';
  var connectionInfo = environment.rabbit;
  var broker;

  beforeEach(function() {
    broker = new Broker(serviceDomainName, appName, connectionInfo);
  });

  afterEach(function() {
    broker.shutdown();
  });

  it('should be able to publish and consume messages', function(done) {
    var theMessage = 'Can I buy your magic bus?';

    var handler = function(msg) {
      var messageContent = new Buffer(msg.content).toString();
      expect(messageContent).to.eq(theMessage);

      broker.ack('subscribe', msg).then(function() {
        done();
      });
    };

    broker.registerRoute('publish', new PublisherRoutePattern());
    broker.registerRoute('subscribe', new WorkerRoutePattern());

    broker.consume('subscribe', handler).then(function() {
      broker.publish('publish', 'succeed', new Buffer(theMessage));
    });
  });

  it('should be able to nack messages and have them end up in a failed queue', function(done) {
    var theMessage = 'Can I buy your magic bus?';

    var handler = function(msg) {
      broker.nack('subscribe', msg, false, false).then(function() {
        done();
      });
    };

    broker.registerRoute('publish', new PublisherRoutePattern());
    broker.registerRoute('subscribe', new WorkerRoutePattern());

    broker.consume('subscribe', handler).then(function() {
      broker.publish('publish', 'fail', new Buffer(theMessage));
    });
  });
});
