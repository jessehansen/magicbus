'use strict';

var magicbus = require('../lib');
var Broker = require('../lib/broker');

var chai = require('chai');
var expect = chai.expect;

var sinon = require('sinon');
var sinonChai = require('sinon-chai');
chai.use(sinonChai);

var Promise = require('bluebird');
var Logger = require('../lib/logger');

describe('Broker', function() {
  var serviceDomainName = 'my-domain';
  var appName = 'my-app';
  var connectionInfo = {
    hostname: 'localhost',
    vhost: '/',
    username: 'guest',
    password: 'guest'
  };
  var broker;
  var logger = new Logger();

  var mockAmqp;
  var mockConnection;
  var mockChannel;

  function setUpSuccessfulAmqpMocks() {
    mockChannel = {
      publish: function(/* exchangeName, routingKey, content, options */) {
        return true;
      },
      consume: function(/* queueName, callback, options */) {
        return Promise.resolve('the-consumer-tag');
      },
      ack: function(/* msg */) {},
      nack: function(/* msg, allUpTo, requeue */) {},
      assertExchange: function(/* exchangeName, type, options */) {
        return Promise.resolve();
      },
      assertQueue: function(queueName /*, options */) {
        return Promise.resolve({
          queue: queueName,
          messageCount: 0,
          consumerCount: 0
        });
      },
      bindQueue: function(/* queueName, exchangeName, pattern */) {
        return Promise.resolve();
      }
    };

    mockConnection = {
      createChannel: function() {
        return Promise.resolve(mockChannel);
      },
      close: function() {},
      on: function() {},
      removeAllListeners: function() {}
    };

    mockAmqp = {
      connect: function(/* connectionString */) {
        return Promise.resolve(mockConnection);
      }
    };
  }

  function setUpBrokerWithSuccessfulAmqpMocks() {
    setUpSuccessfulAmqpMocks();

    broker = magicbus.createBroker(serviceDomainName, appName, connectionInfo, function(cfg){
      cfg.useCustomAmqpLib(mockAmqp);
    });
  }

  describe('constructor', function() {
    it('should throw an assertion error given no amqp implementation', function() {
      var fn = function() {
        new Broker();
      };

      expect(fn).to.throw('AssertionError: amqp (object) is required');
    });
    it('should throw an assertion error given no service domain name', function() {
      var fn = function() {
        new Broker({});
      };

      expect(fn).to.throw('AssertionError: serviceDomainName (string) is required');
    });

    it('should throw an assertion error given no app name', function() {
      var fn = function() {
        new Broker({}, 'my-domain');
      };

      expect(fn).to.throw('AssertionError: appName (string) is required');
    });

    it('should throw an assertion error given no connection info', function() {
      var fn = function() {
        new Broker({}, 'my-domain', 'my-app');
      };

      expect(fn).to.throw('AssertionError: connectionInfo (object) is required');
    });

    it('should throw an assertion error given no logger', function() {
      var fn = function() {
        new Broker({}, 'my-domain', 'my-app', {});
      };

      expect(fn).to.throw('AssertionError: logger (object) is required');
    });

    it('should accept a connection string', function() {
      var connectionString = 'amqp://usr:pass@host/vhost';
      var broker = new Broker({}, 'my-domain', 'my-app', connectionString, logger);

      expect(broker._connectionInfo).to.eq(connectionString);
    });

    it('should accept a connection object', function() {
      var broker = new Broker({}, 'my-domain', 'my-app', connectionInfo, logger);

      expect(broker._connectionInfo).to.eq(connectionInfo);
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

    it('should consume from a queue with the name returned from the route pattern', function() {
      var routeName = 'subscribe';
      var callback = function(/* msg */) {};
      var options = {};

      sinon.spy(mockChannel, 'consume');

      var queueName = 'the-queue';
      var mockRoutePattern = {
        assertRoute: function() {
          return Promise.resolve({
            queueName: queueName
          });
        }
      };
      broker.registerRoute(routeName, mockRoutePattern);

      return broker.consume(routeName, callback, options).then(function() {
        expect(mockChannel.consume).to.have.been.calledWith(queueName, callback, options);
      });
    });
  });

  describe('isConnected', function(){
    var routeName;
    var options;
    var consumeCllbk;
    var queueName;

    beforeEach(function() {
      setUpBrokerWithSuccessfulAmqpMocks();
      routeName = 'subscribe';
      queueName = 'the-queue';
      options = {};
      consumeCllbk = function () {};
      broker.registerRoute(routeName, {
        assertRoute: function() {
          return Promise.resolve({
            queueName: queueName
          });
        }
      });
    });

    it('returns true when there is a connection present', function(){
      return broker.consume(routeName, consumeCllbk, options).then(function() {
        expect(broker.isConnected()).to.eq(true);
      });
    });

    it('returns false if the connection is null', function(){
      expect(broker.isConnected()).to.eq(false);
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

      var queueName = 'the-queue';
      var mockRoutePattern = {
        assertRoute: function() {
          return Promise.resolve({
            queueName: queueName
          });
        }
      };
      broker.registerRoute(routeName, mockRoutePattern);

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

      var queueName = 'the-queue';
      var mockRoutePattern = {
        assertRoute: function() {
          return Promise.resolve({
            queueName: queueName
          });
        }
      };
      broker.registerRoute(routeName, mockRoutePattern);

      return broker.nack(routeName, msg, false, false).then(function() {
        expect(mockChannel.nack).to.have.been.calledWith(msg, false, false);
      });
    });
  });

  describe('shutdown', function() {
    it('should close the connection given it has created a connection', function() {
      setUpBrokerWithSuccessfulAmqpMocks();

      sinon.spy(mockConnection, 'close');

      var queueName = 'the-queue';
      var mockRoutePattern = {
        assertRoute: function() {
          return Promise.resolve({
            queueName: queueName
          });
        }
      };
      broker.registerRoute('my-route', mockRoutePattern);

      return broker.consume('my-route', function() {}).then(function() {
        broker.shutdown();
        expect(mockConnection.close).to.have.been.called;
      });
    });

    it('should not error given it has not created a connection', function() {
      var broker = new Broker({}, serviceDomainName, appName, connectionInfo, logger);
      broker.shutdown();
    });
  });
});
