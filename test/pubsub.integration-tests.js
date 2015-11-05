'use strict';

var magicbus = require('../lib');
var environment = require('./_test-env');

var chai = require('chai');
var expect = chai.expect;

describe('Pub/Sub integration', function() {
  var serviceDomainName = 'magicbus';
  var appName = 'tests';
  var connectionInfo = environment.rabbit.protocol + '://' + environment.rabbit.username + ':' + environment.rabbit.password + '@' + environment.rabbit.hostname + '/' + environment.rabbit.vhost;
  var broker;
  var publisher;
  var subscriber;

  before(function() {
    broker = magicbus.createBroker(serviceDomainName, appName, connectionInfo);
    publisher = magicbus.createPublisher(broker);
    subscriber = magicbus.createSubscriber(broker);

    return magicbus.createBinder(connectionInfo).bind(publisher.getRoute(), subscriber.getRoute(), {pattern: '#'});
  });

  after(function() {
    broker.shutdown();
  });

  it('should be able to publish a message and consume that message', function(done) {
    var eventName = 'something-done';
    var data = {
      it: 'was awesome'
    };

    var handler = function(handlerEventName, handlerData) {
      expect(handlerEventName).to.eq(eventName);
      expect(handlerData).to.eql(data);

      done();
    };

    subscriber.on('something-done', handler);
    subscriber.startSubscription().then(function() {
      publisher.publish(eventName, data);
    });
  });
});
