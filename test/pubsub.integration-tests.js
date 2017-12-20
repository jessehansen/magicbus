'use strict';

var magicbus = require('../lib');
var environment = require('./_test-env');

var chai = require('chai');
var expect = chai.expect;
let Promise = require('bluebird');

describe('Pub/Sub integration', function() {
  var serviceDomainName = 'magicbus';
  var appName = 'tests';
  var connectionInfo = environment.rabbitString;
  var broker;
  var publisher;
  var subscriber;

  before(function() {
    broker = magicbus.createBroker(serviceDomainName, appName, connectionInfo);
    publisher = magicbus.createPublisher(broker);
    subscriber = magicbus.createSubscriber(broker);

    return broker.bind(publisher.getRoute().name, subscriber.getRoute().name, { pattern: '#' })
      .then(function(){
        return subscriber.purgeQueue();
      });
  });

  after(function() {
    return broker.shutdown();
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

  xit('should handle a heavy load without rejecting because of a full write buffer', function() {
    this.timeout(30000); //eslint-disable-line
    let load = [];
    for (let i = 0; i < 100000; ++i) {
      load.push('message ' + i);
    }
    return Promise.map(load, function(message){
      return publisher.publish('load-test', { message: message });
    });
  });
});
