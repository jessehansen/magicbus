'use strict';

var Broker = require('../lib').Broker;
var Sender = require('../lib').Sender;
var Receiver = require('../lib').Receiver;
var environment = require('./_test-env');

var chai = require('chai');
var expect = chai.expect;

describe('Send/Receive integration', function() {
  var serviceDomainName = 'magicbus';
  var appName = 'tests';
  var connectionInfo = environment.rabbit;
  var broker;
  var sender;
  var receiver;

  before(function() {
    broker = new Broker(serviceDomainName, appName, connectionInfo);
    sender = new Sender(broker, {
      routeName: 'publish'
    });
    receiver = new Receiver(broker, {
      routeName: 'subscribe'
    });
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

    receiver.startReceiving(handler).then(function() {
      sender.send(message, messageType);
    });
  });
});
