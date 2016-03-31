'use strict';

var magicbus = require('../lib');
var environment = require('./_test-env');

var chai = require('chai');
var expect = chai.expect;

var PublisherRoutePattern = require('../lib/route-patterns/publisher-route-pattern');
var WorkerRoutePattern = require('../lib/route-patterns/worker-route-pattern');

function noOp () { }

describe('Broker really using RabbitMQ', function() {
  var serviceDomainName = 'magicbus';
  var appName = 'tests';
  var connectionInfo = environment.rabbit;
  var broker;
  var bound;

  beforeEach(function() {
    var p;
    broker = magicbus.createBroker(serviceDomainName, appName, connectionInfo);

    broker.registerRoute('publish', new PublisherRoutePattern());
    broker.registerRoute('subscribe', new WorkerRoutePattern());

    p = Promise.resolve();
    if (!bound){
      p = p.then(function(){
        broker.bind('publish', 'subscribe', { pattern: '#' });
        bound = true;
      });
    }
    return p.then(function(){
      return broker.purgeRouteQueue('subscribe');
    });
  });

  afterEach(function() {
    return broker.shutdown()
      .then(function() {
        broker = null;
      });
  });

  describe('lifetime management', function(){
    it('should be able to shutdown many times without problems', function() {
      broker.shutdown();
      return broker.shutdown();
    });
    it('should not allow publish after shutdown', function() {
      let caught = false;
      return broker.shutdown()
        .then(()=>{
          return broker.publish('publish', { routingKey: 'fail', payload: new Buffer('dead') });
        })
        .catch(()=>{
          caught = true;
        })
        .then(()=>{
          expect(caught).to.equal(true);
        });
    });
    it('should not allow consume after shutdown', function() {
      let caught = false;
      return broker.shutdown()
        .then(()=>{
          return broker.consume('subscribe', noOp);
        })
        .catch(()=>{
          caught = true;
        })
        .then(()=>{
          expect(caught).to.equal(true);
        });
    });
  });

  describe('with consumption defaults', function(){
    it('should be able to publish and consume messages', function(done) {
      var theMessage = 'Can I buy your magic bus?';

      var handler = function(msg, ops) {
        var messageContent = new Buffer(msg.content).toString();
        expect(messageContent).to.eq(theMessage);

        ops.ack();
        done();
      };

      broker.consume('subscribe', handler).then(function() {
        broker.publish('publish', { routingKey: 'succeed', payload: new Buffer(theMessage) });
      });
    });

    it('should be able to reject messages and have them end up in a failed queue', function(done) {
      var theMessage = 'Can I buy your magic bus?';

      var handler = function(msg, ops) {
        ops.reject();
        done();
      };

      broker.consume('subscribe', handler).then(function() {
        broker.publish('publish', { routingKey: 'fail', payload: new Buffer(theMessage) });
      });
    });

    it('should be able to nack messages and have them redelivered', function(done) {
      var theMessage = 'Can I buy your magic bus?';
      let count = 0;

      var handler = function(msg, ops) {
        if (count++ === 1) {
          ops.nack();
        } else {
          ops.ack();
          done();
        }
      };

      broker.consume('subscribe', handler).then(function() {
        broker.publish('publish', { routingKey: 'fail', payload: new Buffer(theMessage) });
      });
    });

    it('should be able to ack and nack multiple messages and have them be batched', function(done) {
      var messageCount = 0, targetCount = 10;

      var handler = function(msg, ops) {
        var messageContent = parseInt(new Buffer(msg.content).toString(), 10);
        messageCount++;
        if (messageContent > 3 && messageContent < 7){
          ops.ack();
        } else {
          ops.reject();
        }
        if (messageCount === targetCount) {
          done();
          // right now, I'm manually verifying that the subscribe queue is empty after broker shutdown
        }
      };

      broker.consume('subscribe', handler).then(function() {
        var i;
        for (i = 0; i < targetCount; i++) {
          broker.publish('publish', { routingKey: 'fail', payload: new Buffer(String(i)) });
        }
      });
    });
  });

  describe('with noBatch specified', function(){
    it('should be able to publish and consume messages', function(done) {
      var theMessage = 'Can I buy your magic bus?';

      var handler = function(msg, ops) {
        var messageContent = new Buffer(msg.content).toString();
        expect(messageContent).to.eq(theMessage);

        ops.ack();
        done();
      };

      broker.consume('subscribe', handler, { noBatch: true, limit: 10 }).then(function() {
        broker.publish('publish', { routingKey: 'succeed', payload: new Buffer(theMessage) });
      });
    });

    it('should be able to ack, reject, and nack messages', function(done) {
      var messageCount = 0, targetCount = 10;

      var handler = function(msg, ops) {
        var messageContent = parseInt(new Buffer(msg.content).toString(), 10);
        messageCount++;
        if (messageContent > 3 && messageContent < 7){
          ops.ack();
        } else if (messageContent < 7) {
          ops.reject();
        } else {
          ops.nack();
        }
        if (messageCount === targetCount) {
          done();
          // right now, I'm manually verifying that the subscribe queue is empty after broker shutdown
        }
      };

      broker.consume('subscribe', handler, { noBatch: true, limit: 10 }).then(function() {
        var i;
        for (i = 0; i < targetCount; i++) {
          broker.publish('publish', { routingKey: 'fail', payload: new Buffer(String(i)) });
        }
      });
    });
  });

  describe('with noAck specified', function(){
    beforeEach(function(){
      broker.registerRoute('publishNoAck', new PublisherRoutePattern());
      broker.registerRoute('subscribeNoAck', new WorkerRoutePattern({ noAck: true }));
      return broker.bind('publishNoAck', 'subscribeNoAck', { pattern: '#' }).then(()=>{
        return broker.purgeRouteQueue('subscribeNoAck');
      });
    });

    it('should be able to publish and consume messages', function(done) {
      var theMessage = 'Can I buy your magic bus?';

      var handler = function(msg, ops) {
        var messageContent = new Buffer(msg.content).toString();
        expect(messageContent).to.eq(theMessage);

        ops.ack();
        done();
      };

      broker.consume('subscribeNoAck', handler).then(function() {
        broker.publish('publishNoAck', { routingKey: 'succeed', payload: new Buffer(theMessage) });
      });
    });

    it('should be able to ack, reject, and nack messages', function(done) {
      var messageCount = 0, targetCount = 10;

      var handler = function(msg, ops) {
        var messageContent = parseInt(new Buffer(msg.content).toString(), 10);
        messageCount++;
        if (messageContent > 3 && messageContent < 7){
          ops.ack();
        } else if (messageContent < 7) {
          ops.reject();
        } else {
          ops.nack();
        }
        if (messageCount === targetCount) {
          done();
        }
      };

      broker.consume('subscribeNoAck', handler).then(function() {
        var i;
        for (i = 0; i < targetCount; i++) {
          broker.publish('publishNoAck', { routingKey: 'fail', payload: new Buffer(String(i)) });
        }
      });
    });
  });

  describe('with noAck and noBatch specified', function(){
    beforeEach(function(){
      broker.registerRoute('publishNoAck', new PublisherRoutePattern());
      broker.registerRoute('subscribeNoAck', new WorkerRoutePattern({ noAck: true }));
      return broker.bind('publishNoAck', 'subscribeNoAck', { pattern: '#' }).then(()=>{
        return broker.purgeRouteQueue('subscribeNoAck');
      });
    });

    it('should be able to publish and consume messages', function(done) {
      var theMessage = 'Can I buy your magic bus?';

      var handler = function(msg, ops) {
        var messageContent = new Buffer(msg.content).toString();
        expect(messageContent).to.eq(theMessage);

        ops.ack();
        done();
      };

      broker.consume('subscribeNoAck', handler, { noBatch: true, limit: 10 }).then(function() {
        broker.publish('publishNoAck', { routingKey: 'succeed', payload: new Buffer(theMessage) });
      });
    });

    it('should be able to ack, reject, and nack messages', function(done) {
      var messageCount = 0, targetCount = 10;

      var handler = function(msg, ops) {
        var messageContent = parseInt(new Buffer(msg.content).toString(), 10);
        messageCount++;
        if (messageContent > 3 && messageContent < 7){
          ops.ack();
        } else if (messageContent < 7) {
          ops.reject();
        } else {
          ops.nack();
        }
        if (messageCount === targetCount) {
          done();
        }
      };

      broker.consume('subscribeNoAck', handler, { noBatch: true, limit: 10 }).then(function() {
        var i;
        for (i = 0; i < targetCount; i++) {
          broker.publish('publishNoAck', { routingKey: 'fail', payload: new Buffer(String(i)) });
        }
      });
    });
  });
});
