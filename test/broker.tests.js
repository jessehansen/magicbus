'use strict';

var Broker = require('../').Broker;

var chai = require('chai');
var expect = chai.expect;

var sinon = require('sinon');
var sinonChai = require('sinon-chai');
chai.use(sinonChai);

var Promise = require('bluebird');

describe('Broker', function() {
  var serviceDomainName = 'my-domain';
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
        });
      },
      ack: function(msg) {},
      nack: function(msg, allUpTo, requeue) {},
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
      },
      bindQueue: function(queueName, exchangeName, pattern) {
        return new Promise(function(resolve, reject) {
          resolve();
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

    broker = new Broker(serviceDomainName, appName, connectionInfo);
    broker._amqp = mockAmqp;
  }

  describe('constructor', function() {
    it('should throw an assertion error given no service domain name', function() {
      var fn = function() {
        new Broker();
      };

      expect(fn).to.throw('AssertionError: serviceDomainName (string) is required');
    });

    it('should throw an assertion error given no app name', function() {
      var fn = function() {
        new Broker('my-domain');
      };

      expect(fn).to.throw('AssertionError: appName (string) is required');
    });

    it('should throw an assertion error given no connection info', function() {
      var fn = function() {
        new Broker('my-domain', 'my-app');
      };

      expect(fn).to.throw('AssertionError: connectionInfo (object) is required');
    });
  });

  describe('registerRoute', function() {
    beforeEach(function() {
      setUpBrokerWithSuccessfulAmqpMocks();
    });

    it('should keep track of the pattern of the route', function() {
      var routeName = 'publish';
      var routePattern = 'topic-publisher';

      broker.registerRoute(routeName, routePattern);

      expect(broker.getRoutePattern(routeName)).to.eq(routePattern);
    });
  });

  describe('publish', function() {
    beforeEach(function() {
      setUpBrokerWithSuccessfulAmqpMocks();
    });

    it('should publish to an exchange with the name returned from the route pattern', function() {
      var routeName = 'publish';
      var routingKey = 'the.routing.key';
      var content = new Buffer('content');
      var options = {};

      sinon.spy(mockChannel, 'publish');

      var exchangeName = 'the-exchange';
      var mockRoutePattern = {
        assertRoute: function() {
          return Promise.resolve({
            exchangeName: exchangeName
          });
        }
      };
      broker.registerRoute(routeName, mockRoutePattern);

      return broker.publish(routeName, routingKey, content, options).then(function() {
        expect(mockChannel.publish).to.have.been.calledWith(exchangeName, routingKey, content, options);
      });
    });
  });

  describe('consume', function() {
    beforeEach(function() {
      setUpBrokerWithSuccessfulAmqpMocks();
    });

    it('should consume from a queue with a name derived from the serviceDomainName, appName and routeName', function() {
      var routeName = 'subscribe';
      var callback = function(msg) {};
      var options = {};

      sinon.spy(mockChannel, 'consume');

      broker.registerRoute(routeName, 'worker');

      return broker.consume(routeName, callback, options).then(function() {
        expect(mockChannel.consume).to.have.been.calledWith('my-domain.my-app.subscribe', callback, options);
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

      broker.registerRoute(routeName, 'worker');

      return broker.ack(routeName, msg).then(function() {
        expect(mockChannel.ack).to.have.been.calledWith(msg);
      });
    });
  });

  describe('nack', function() {
    beforeEach(function() {
      setUpBrokerWithSuccessfulAmqpMocks();
    });

    it('should nack through a channel given a message', function() {
      var routeName = 'subscribe';
      var msg = {};

      sinon.spy(mockChannel, 'nack');

      broker.registerRoute(routeName, 'worker');

      return broker.nack(routeName, msg, false, false).then(function() {
        expect(mockChannel.nack).to.have.been.calledWith(msg, false, false);
      });
    });
  });

  describe('shutdown', function() {
    it('should close the connection given it has created a connection', function() {
      setUpBrokerWithSuccessfulAmqpMocks();

      sinon.spy(mockConnection, 'close');

      broker.registerRoute('my-route', 'worker');

      return broker.consume('my-route', function() {}).then(function() {
        broker.shutdown();
        expect(mockConnection.close).to.have.been.called;
      });
    });

    it('should not error given it has not created a connection', function() {
      var broker = new Broker(serviceDomainName, appName, connectionInfo);
      broker.shutdown();
    });
  });
});