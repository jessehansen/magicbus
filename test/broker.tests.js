'use strict';

var Broker = require('../').Broker;

var chai = require('chai');
var expect = chai.expect;

var sinon = require('sinon');
var sinonChai = require('sinon-chai');
chai.use(sinonChai);

describe('Broker', function() {
  var appName = 'my-app';
  var connectionInfo = {
    server: 'localhost',
    vhost: '/',
    user: 'guest',
    pass: 'guest'
  };
  var broker;

  var mockAmqp;
  var mockConnection;
  var mockChannel;

  function setUpSuccessfulAmqpMocks() {
    mockChannel = {
      publish: function(exchangeName, routingKey, content, options) {
        return true;
      },
      consume: function(queueName, callback, options) {
        return new Promise(function(resolve, reject) {
          resolve('the-consumer-tag');
        })
      },
      ack: function(msg) {},
      assertExchange: function(exchangeName, type, options) {
        return new Promise(function(resolve, reject) {
          resolve();
        });
      },
      assertQueue: function(queueName, options) {
        return new Promise(function(resolve, reject) {
          resolve({
            queue: queueName,
            messageCount: 0,
            consumerCount: 0
          });
        });
      }
    };

    mockConnection = {
      createChannel: function() {
        return new Promise(function(resolve, reject) {
          resolve(mockChannel);
        });
      },
      close: function() {}
    };

    mockAmqp = {
      connect: function(connectionString) {
        return new Promise(function(resolve, reject) {
          resolve(mockConnection);
        });
      }
    };
  }

  function setUpBrokerWithSuccessfulAmqpMocks() {
    setUpSuccessfulAmqpMocks();

    broker = new Broker(appName, connectionInfo);
    broker._amqp = mockAmqp;
  }

  describe('constructor', function() {
    it('should throw an assertion error given no app name', function() {
      var fn = function() {
        new Broker();
      };

      expect(fn).to.throw('AssertionError: appName (string) is required');
    });

    it('should throw an assertion error given no connection info', function() {
      var fn = function() {
        new Broker('my-app');
      };

      expect(fn).to.throw('AssertionError: connectionInfo (object) is required');
    });
  });

  describe('publish', function() {
    beforeEach(function() {
      setUpBrokerWithSuccessfulAmqpMocks();
    });

    it('should publish to an exchange with a name derived from the appName and routeName', function() {
      var routeName = 'publish';
      var routingKey = 'the.routing.key';
      var content = new Buffer('content');
      var options = {};

      sinon.spy(mockChannel, 'publish');

      return broker.publish(routeName, routingKey, content, options).then(function() {
        expect(mockChannel.publish).to.have.been.calledWith('my-app.publish', routingKey, content, options);
      });
    });
  });

  describe('consume', function() {
    beforeEach(function() {
      setUpBrokerWithSuccessfulAmqpMocks();
    });

    it('should consume from a queue with a name derived from the appName and routeName', function() {
      var routeName = 'subscribe';
      var callback = function(msg) {};
      var options = {};

      sinon.spy(mockChannel, 'consume');

      return broker.consume(routeName, callback, options).then(function() {
        expect(mockChannel.consume).to.have.been.calledWith('my-app.subscribe', callback, options);
      });
    });
  });

  describe('ack', function() {
    beforeEach(function() {
      setUpBrokerWithSuccessfulAmqpMocks();
    });

    it('should ack through a channel given a message', function() {
      var routeName = 'subscribe';
      var msg = {};

      sinon.spy(mockChannel, 'ack');

      return broker.ack(routeName, msg).then(function() {
        expect(mockChannel.ack).to.have.been.calledWith(msg);
      });
    });
  });

  describe('shutdown', function() {
    it('should close the connection given it has created a connection', function() {
      setUpBrokerWithSuccessfulAmqpMocks();

      sinon.spy(mockConnection, 'close');

      return broker.consume('my-route', function() {}).then(function() {
        broker.shutdown();
        expect(mockConnection.close).to.have.been.called;
      });
    });

    it('should not error given it has not created a connection', function() {
      var broker = new Broker(appName, connectionInfo);
      broker.shutdown();
    });
  });
});