'use strict';

var Configurator = require('../../lib/config');
var Broker = require('../../lib/broker');
var Publisher = require('../../lib/publisher');
var Consumer = require('../../lib/consumer');
var Subscriber = require('../../lib/subscriber');
var Binder = require('../../lib/binder');
var Logger = require('../../lib/logger');

var BasicEnvelope = require('../../lib/basic-envelope');
var ProducerPipeline = require('../../lib/middleware').ProducerPipeline;
var ConsumerPipeline = require('../../lib/middleware').ConsumerPipeline;
var PublisherRoutePattern = require('../../lib/route-patterns/publisher-route-pattern');
var WorkerRoutePattern = require('../../lib/route-patterns/worker-route-pattern');

var chai = require('chai');
var expect = chai.expect;

var amqplib = require('amqplib');

describe('Configurator', function(){
  var configurator;
  var broker;
  var logger;

  beforeEach(function(){
    broker = {
      registerRoute: function(){}
    };
    logger = new Logger();
    configurator = new Configurator(logger);
  });

  describe('#createBroker', function(){
    var serviceDomainName = 'my-domain';
    var appName = 'my-app';
    var connectionInfo = {
      server: 'localhost',
      vhost: '/',
      user: 'guest',
      pass: 'guest'
    };

    it('should create a broker with the default params', function(){
      var broker = configurator.createBroker(serviceDomainName, appName, connectionInfo);

      expect(broker).to.be.an.instanceOf(Broker);
      expect(broker._amqp).to.equal(amqplib);
      expect(broker._logger).to.equal(logger);
    });

    it('should allow caller to override amqplib', function(){
      var myCustomAmqp = {};
      var broker = configurator.createBroker(serviceDomainName, appName, connectionInfo, function(cfg){
        cfg.useCustomAmqpLib(myCustomAmqp);
      });

      expect(broker).to.be.an.instanceOf(Broker);
      expect(broker._amqp).to.equal(myCustomAmqp);
    });

    it('should allow caller to override amqplib with a factory', function(){
      var myCustomAmqp = {};
      var broker = configurator.createBroker(serviceDomainName, appName, connectionInfo, function(cfg){
        cfg.useCustomAmqpLib(function(){
          return myCustomAmqp;
        });
      });

      expect(broker).to.be.an.instanceOf(Broker);
      expect(broker._amqp).to.equal(myCustomAmqp);
    });
  });

  describe('#createPublisher', function(){
    it('should create a publisher with the default params', function(){
      var publisher = configurator.createPublisher(broker);

      expect(publisher).to.be.an.instanceOf(Publisher);
      expect(publisher._envelope).to.be.an.instanceOf(BasicEnvelope);
      expect(publisher._pipeline).to.be.an.instanceOf(ProducerPipeline);
      expect(publisher._routeName).to.equal('publish');
      expect(publisher._routePattern).to.be.an.instanceOf(PublisherRoutePattern);
      expect(publisher._logger).to.equal(logger);
    });

    it('should allow caller to override the envelope', function(){
      var myEnvelope = {};
      var publisher = configurator.createPublisher(broker, function(cfg){
        cfg.useEnvelope(myEnvelope);
      });

      expect(publisher).to.be.an.instanceOf(Publisher);
      expect(publisher._envelope).to.equal(myEnvelope);
    });

    it('should allow caller to override the middleware pipeline', function(){
      var myPipeline = {};
      var publisher = configurator.createPublisher(broker, function(cfg){
        cfg.usePipeline(myPipeline);
      });

      expect(publisher).to.be.an.instanceOf(Publisher);
      expect(publisher._pipeline).to.equal(myPipeline);
    });

    it('should allow caller to override the route name', function(){
      var myRouteName = 'publish2';
      var publisher = configurator.createPublisher(broker, function(cfg){
        cfg.useRouteName(myRouteName);
      });

      expect(publisher).to.be.an.instanceOf(Publisher);
      expect(publisher._routeName).to.equal(myRouteName);
    });

    it('should allow caller to override the route pattern', function(){
      var myRoutePattern = {};
      var publisher = configurator.createPublisher(broker, function(cfg){
        cfg.useRoutePattern(myRoutePattern);
      });

      expect(publisher).to.be.an.instanceOf(Publisher);
      expect(publisher._routePattern).to.equal(myRoutePattern);
    });
  });

  describe('#createConsumer', function(){
    it('should create a consumer with the default params', function(){
      var consumer = configurator.createConsumer(broker);

      expect(consumer).to.be.an.instanceOf(Consumer);
      expect(consumer._envelope).to.be.an.instanceOf(BasicEnvelope);
      expect(consumer._pipeline).to.be.an.instanceOf(ConsumerPipeline);
      expect(consumer._routeName).to.equal('receive');
      expect(consumer._routePattern).to.be.an.instanceOf(WorkerRoutePattern);
      expect(consumer._logger).to.equal(logger);
    });

    it('should allow caller to override the envelope', function(){
      var myEnvelope = {};
      var consumer = configurator.createConsumer(broker, function(cfg){
        cfg.useEnvelope(myEnvelope);
      });

      expect(consumer).to.be.an.instanceOf(Consumer);
      expect(consumer._envelope).to.equal(myEnvelope);
    });

    it('should allow caller to override the middleware pipeline', function(){
      var myPipeline = {};
      var consumer = configurator.createConsumer(broker, function(cfg){
        cfg.usePipeline(myPipeline);
      });

      expect(consumer).to.be.an.instanceOf(Consumer);
      expect(consumer._pipeline).to.equal(myPipeline);
    });

    it('should allow caller to override the route name', function(){
      var myRouteName = 'publish2';
      var consumer = configurator.createConsumer(broker, function(cfg){
        cfg.useRouteName(myRouteName);
      });

      expect(consumer).to.be.an.instanceOf(Consumer);
      expect(consumer._routeName).to.equal(myRouteName);
    });

    it('should allow caller to override the route pattern', function(){
      var myRoutePattern = {};
      var consumer = configurator.createConsumer(broker, function(cfg){
        cfg.useRoutePattern(myRoutePattern);
      });

      expect(consumer).to.be.an.instanceOf(Consumer);
      expect(consumer._routePattern).to.equal(myRoutePattern);
    });
  });

  describe('#createSubscriber', function(){
    it('should create a subscriber with the default params', function(){
      var subscriber = configurator.createSubscriber(broker);

      expect(subscriber).to.be.an.instanceOf(Subscriber);
      expect(subscriber._logger).to.equal(logger);
      var consumer = subscriber._consumer;

      expect(consumer).to.be.an.instanceOf(Consumer);
      expect(consumer._envelope).to.be.an.instanceOf(BasicEnvelope);
      expect(consumer._pipeline).to.be.an.instanceOf(ConsumerPipeline);
      expect(consumer._routeName).to.equal('subscribe');
      expect(consumer._routePattern).to.be.an.instanceOf(WorkerRoutePattern);
      expect(consumer._logger).to.equal(logger);
    });

    it('should allow caller to override the envelope', function(){
      var myEnvelope = {};
      var subscriber = configurator.createSubscriber(broker, function(cfg){
        cfg.useEnvelope(myEnvelope);
      });

      expect(subscriber).to.be.an.instanceOf(Subscriber);
      var consumer = subscriber._consumer;
      expect(consumer._envelope).to.equal(myEnvelope);
    });

    it('should allow caller to override the middleware pipeline', function(){
      var myPipeline = {};
      var subscriber = configurator.createSubscriber(broker, function(cfg){
        cfg.usePipeline(myPipeline);
      });

      expect(subscriber).to.be.an.instanceOf(Subscriber);
      var consumer = subscriber._consumer;
      expect(consumer._pipeline).to.equal(myPipeline);
    });

    it('should allow caller to override the route name', function(){
      var myRouteName = 'publish2';
      var subscriber = configurator.createSubscriber(broker, function(cfg){
        cfg.useRouteName(myRouteName);
      });

      expect(subscriber).to.be.an.instanceOf(Subscriber);
      var consumer = subscriber._consumer;
      expect(consumer._routeName).to.equal(myRouteName);
    });

    it('should allow caller to override the route pattern', function(){
      var myRoutePattern = {};
      var subscriber = configurator.createSubscriber(broker, function(cfg){
        cfg.useRoutePattern(myRoutePattern);
      });

      expect(subscriber).to.be.an.instanceOf(Subscriber);
      var consumer = subscriber._consumer;
      expect(consumer._routePattern).to.equal(myRoutePattern);
    });

    it('should allow caller to override the consumer', function(){
      var myConsumer = {};
      var subscriber = configurator.createSubscriber(function(cfg){
        cfg.useConsumer(myConsumer);
      });

      expect(subscriber).to.be.an.instanceOf(Subscriber);
      expect(subscriber._consumer).to.equal(myConsumer);
    });
  });

  describe('#createBinder', function(){
    var connectionInfo = {
      server: 'localhost',
      vhost: '/',
      user: 'guest',
      pass: 'guest'
    };

    it('should create a binder with the default params', function(){
      var binder = configurator.createBinder(connectionInfo);

      expect(binder).to.be.an.instanceOf(Binder);
      expect(binder._amqp).to.equal(amqplib);
      expect(binder._logger).to.equal(logger);
    });

    it('should allow caller to override amqplib', function(){
      var myCustomAmqp = {};
      var binder = configurator.createBinder(connectionInfo, function(cfg){
        cfg.useCustomAmqpLib(myCustomAmqp);
      });

      expect(binder).to.be.an.instanceOf(Binder);
      expect(binder._amqp).to.equal(myCustomAmqp);
    });

    it('should allow caller to override amqplib with a factory', function(){
      var myCustomAmqp = {};
      var binder = configurator.createBinder(connectionInfo, function(cfg){
        cfg.useCustomAmqpLib(function(){
          return myCustomAmqp;
        });
      });

      expect(binder).to.be.an.instanceOf(Binder);
      expect(binder._amqp).to.equal(myCustomAmqp);
    });
  });

});
