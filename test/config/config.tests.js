'use strict';

const Configurator = require('../../lib/config');
const Logger = require('@leisurelink/skinny-event-loggins');
const EventEmitter = require('events').EventEmitter;

const chai = require('chai');
const expect = chai.expect;

describe('Configurator', function(){
  var configurator;
  var broker;
  var events;
  var logger;

  beforeEach(function(){
    broker = {
      registerRoute: function(){}
    };
    events = new EventEmitter();
    logger = Logger('magicbus.tests', events);
    configurator = new Configurator(logger, events);
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

      expect(broker).to.be.ok;
      expect(broker.shutdown).to.be.ok;
    });
  });

  describe('#createPublisher', function(){
    it('should create a publisher with the default params', function(){
      var publisher = configurator.createPublisher(broker);

      expect(publisher).to.be.ok;
    });

    it('should allow caller to override the envelope', function(){
      var myEnvelope = {};
      var publisher = configurator.createPublisher(broker, function(cfg){
        cfg.useEnvelope(myEnvelope);
      });

      expect(publisher).to.be.ok;
    });

    it('should allow caller to override the middleware pipeline', function(){
      var myPipeline = { useLogger: function() {} };
      var publisher = configurator.createPublisher(broker, function(cfg){
        cfg.usePipeline(myPipeline);
      });

      expect(publisher).to.be.ok;
    });

    it('should allow caller to override the route name', function(){
      var myRouteName = 'publish2';
      var publisher = configurator.createPublisher(broker, function(cfg){
        cfg.useRouteName(myRouteName);
      });

      expect(publisher).to.be.ok;
    });

    it('should allow caller to override the route pattern', function(){
      var myRoutePattern = {};
      var publisher = configurator.createPublisher(broker, function(cfg){
        cfg.useRoutePattern(myRoutePattern);
      });

      expect(publisher).to.be.ok;
    });
  });

  describe('#createConsumer', function(){
    it('should create a consumer with the default params', function(){
      var consumer = configurator.createConsumer(broker);

      expect(consumer).to.be.ok;
    });

    it('should allow caller to override the envelope', function(){
      var myEnvelope = {};
      var consumer = configurator.createConsumer(broker, function(cfg){
        cfg.useEnvelope(myEnvelope);
      });

      expect(consumer).to.be.ok;
    });

    it('should allow caller to override the middleware pipeline', function(){
      var myPipeline = { useLogger: function() {} };
      var consumer = configurator.createConsumer(broker, function(cfg){
        cfg.usePipeline(myPipeline);
      });

      expect(consumer).to.be.ok;
    });

    it('should allow caller to override the route name', function(){
      var myRouteName = 'publish2';
      var consumer = configurator.createConsumer(broker, function(cfg){
        cfg.useRouteName(myRouteName);
      });

      expect(consumer).to.be.ok;
    });

    it('should allow caller to override the route pattern', function(){
      var myRoutePattern = {};
      var consumer = configurator.createConsumer(broker, function(cfg){
        cfg.useRoutePattern(myRoutePattern);
      });

      expect(consumer).to.be.ok;
    });
  });

  describe('#createSubscriber', function(){
    it('should create a subscriber with the default params', function(){
      var subscriber = configurator.createSubscriber(broker);

      expect(subscriber).to.be.ok;
    });

    it('should allow caller to override the envelope', function(){
      var myEnvelope = {};
      var subscriber = configurator.createSubscriber(broker, function(cfg){
        cfg.useEnvelope(myEnvelope);
      });

      expect(subscriber).to.be.ok;
    });

    it('should allow caller to override the middleware pipeline', function(){
      var myPipeline = { useLogger: function() {} };
      var subscriber = configurator.createSubscriber(broker, function(cfg){
        cfg.usePipeline(myPipeline);
      });

      expect(subscriber).to.be.ok;
    });

    it('should allow caller to override the route name', function(){
      var myRouteName = 'publish2';
      var subscriber = configurator.createSubscriber(broker, function(cfg){
        cfg.useRouteName(myRouteName);
      });

      expect(subscriber).to.be.ok;
    });

    it('should allow caller to override the route pattern', function(){
      var myRoutePattern = {};
      var subscriber = configurator.createSubscriber(broker, function(cfg){
        cfg.useRoutePattern(myRoutePattern);
      });

      expect(subscriber).to.be.ok;
    });

    it('should allow caller to override the consumer', function(){
      var myConsumer = {};
      var subscriber = configurator.createSubscriber(function(cfg){
        cfg.useConsumer(myConsumer);
      });

      expect(subscriber).to.be.ok;
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

      expect(binder).to.be.ok;
      expect(binder.bind).to.be.ok;
    });
  });

});
