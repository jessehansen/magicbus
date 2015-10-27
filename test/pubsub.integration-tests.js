'use strict';

var Broker = require('../lib').Broker;
var Publisher = require('../lib').Publisher;
var Subscriber = require('../lib').Subscriber;
var Binder = require('../lib').Binder;
var environment = require('./_test-env');

var chai = require('chai');
var expect = chai.expect;

describe('Pub/Sub integration', function() {
  var serviceDomainName = 'magicbus';
  var appName = 'tests';
  var connectionInfo = environment.rabbit;
  var broker;
  var publisher;
  var subscriber;

  before(function() {
    broker = new Broker(serviceDomainName, appName, connectionInfo);
    publisher = new Publisher(broker);
    subscriber = new Subscriber(broker);

    return new Binder(connectionInfo).bind(publisher.getRoute(), subscriber.getRoute(), {pattern: '#'});
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
