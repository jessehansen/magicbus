'use strict';

var magicbus = require('../lib');
var environment = require('./_test-env');

var chai = require('chai');
var expect = chai.expect;

var PublisherRoutePattern = require('../lib/route-patterns/publisher-route-pattern');
var WorkerRoutePattern = require('../lib/route-patterns/worker-route-pattern');

describe('Broker really using RabbitMQ', function() {
  var serviceDomainName = 'magicbus';
  var appName = 'tests';
  var connectionInfo = environment.rabbit;
  var broker;

  before(function(){
    return magicbus.createBinder(connectionInfo).bind({
      serviceDomainName: serviceDomainName,
      appName: appName,
      name: 'publish',
      pattern: new PublisherRoutePattern()
    }, {
      serviceDomainName: serviceDomainName,
      appName: appName,
      name: 'subscribe',
      pattern: new WorkerRoutePattern()
    }, { pattern: '#' });
  });

  beforeEach(function() {
    broker = magicbus.createBroker(serviceDomainName, appName, connectionInfo);

    broker.registerRoute('publish', new PublisherRoutePattern());
    broker.registerRoute('subscribe', new WorkerRoutePattern());

    return broker.purgeRouteQueue('subscribe');
  });

  afterEach(function() {
    return broker.shutdown()
      .then(function() {
        broker = null;
      });
  });

  it('should be able to publish and consume messages', function(done) {
    var theMessage = 'Can I buy your magic bus?';

    var handler = function(msg, ops) {
      var messageContent = new Buffer(msg.content).toString();
      expect(messageContent).to.eq(theMessage);

      ops.ack();
      done();
    };

    broker.consume('subscribe', handler).then(function() {
      broker.publish('publish', 'succeed', new Buffer(theMessage));
    });
  });

  it('should be able to reject messages and have them end up in a failed queue', function(done) {
    var theMessage = 'Can I buy your magic bus?';

    var handler = function(msg, ops) {
      ops.reject();
      done();
    };

    broker.consume('subscribe', handler).then(function() {
      broker.publish('publish', 'fail', new Buffer(theMessage));
    });
  });

  it('should be able to ack and nack multiple messages and have them be batched', function(done) {
    var messageCount = 0, targetCount = 10;

    var handler = function(msg, ops) {
      var messageContent = parseInt(new Buffer(msg.content).toString(), 10);
      messageCount++;
      if (messageContent > 3 && messageContent < 7){
        ops.ack();
      } else {
        ops.reject();
      }
      if (messageCount === targetCount) {
        done();
        // right now, I'm manually verifying that the subscribe queue is empty after broker shutdown
      }
    };

    broker.consume('subscribe', handler).then(function() {
      var i;
      for (i = 0; i < targetCount; i++) {
        broker.publish('publish', 'fail', new Buffer(String(i)));
      }
    });
  });
});
