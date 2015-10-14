'use strict';

var Broker = require('../').Broker;

var chai = require('chai');
var expect = chai.expect;

describe('Broker really using RabbitMQ', function() {
  var appName = 'magicbus-tests';
  var connectionInfo = {
    server: 'localhost',
    vhost: '/',
    user: 'guest',
    pass: 'guest'
  };
  var broker;

  before(function() {
    broker = new Broker(appName, connectionInfo);
  });

  after(function() {
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

    broker.registerRoute('publish', 'topic-publisher');
    broker.registerRoute('subscribe', 'worker');

    broker.consume('subscribe', handler).then(function() {
      broker.publish('publish', 'anything', new Buffer(theMessage));
    });
  });
});