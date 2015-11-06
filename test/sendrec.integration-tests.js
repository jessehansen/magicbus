'use strict';

var magicbus = require('../lib');
var environment = require('./_test-env');

var chai = require('chai');
var expect = chai.expect;

describe('Send/Receive integration', function() {
  var serviceDomainName = 'magicbus';
  var appName = 'tests';
  var connectionInfo = environment.rabbitConnectionObject;
  var broker;
  var sender;
  var receiver;

  before(function() {
    broker = magicbus.createBroker(serviceDomainName, appName, connectionInfo);
    sender = magicbus.createPublisher(broker, function(cfg){ cfg.useRouteName('publish'); });
    receiver = magicbus.createConsumer(broker, function(cfg){ cfg.useRouteName('subscribe'); });

    return magicbus.createBinder(connectionInfo).bind(sender.getRoute(), receiver.getRoute(), {pattern: '#'});
  });

  after(function() {
    broker.shutdown();
  });

  it('should be able to send a message and receive that message', function(done) {
    var message = {
      fooId: 123
    };
    var messageType = 'deactivateFooCommand';

    var handler = function(handlerMessage, handlerMessageTypes) {
      expect(handlerMessage).to.eql(message);
      expect(handlerMessageTypes).to.eql([messageType]);

      done();
    };

    receiver.startConsuming(handler).then(function() {
      sender.send(message, messageType);
    });
  });
});
