'use strict';

var Broker = require('../').Broker;
var Publisher = require('../').Publisher;

var chai = require('chai');
var expect = chai.expect;

describe('Pub/Sub integration', function() {
  var appName = 'magicbus-tests';
  var connectionInfo = {
    server: 'localhost',
    vhost: '/',
    user: 'guest',
    pass: 'guest'
  };
  var broker;
  var publisher;

  before(function() {
    broker = new Broker(appName, connectionInfo);
    publisher = new Publisher(broker);
  });

  it('should be able to publish a message and consume that message', function(done) {
    var eventName = 'something-done';
    var data = {
      it: 'was awesome'
    };

    var handler = function(msg) {
      expect(msg.properties.type).to.eq(eventName);

      var payload = JSON.parse(msg.content.toString('utf8'));
      expect(payload).to.eql(data);

      broker.ack('subscribe', msg);

      done();
    };

    broker.consume('subscribe', handler).then(function() {
      publisher.publish(eventName, data);
    });
  });
});