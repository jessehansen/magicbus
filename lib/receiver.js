'use strict';

var assert = require('assert-plus');
var _ = require('lodash');
var BasicEnvelope = require('./basic-envelope.js');
var ConsumerPipeline = require('./middleware').ConsumerPipeline;
var WorkerRoutePattern = require('./route-patterns/worker-route-pattern.js');

module.exports = Consumer;

function Consumer(broker, options) {
  assert.object(broker, 'broker');
  assert.optionalObject(options, 'options');

  if (options) {
    assert.optionalObject(options.envelope, 'options.envelope');
    assert.optionalObject(options.pipeline, 'options.pipeline');
  }

  var envelope = new BasicEnvelope();
  if (options && options.envelope) {
    envelope = options.envelope;
  }

  var pipeline;
  if (options && options.pipeline && !Array.isArray(options.pipeline)) {
    assert.func(options.pipeline.execute);
    pipeline = options.pipeline;
  } else if (options) {
    assert.optionalArrayOfFunc(options.pipeline);
    pipeline = new ConsumerPipeline(options.pipeline);
  } else {
    pipeline = new ConsumerPipeline();
  }

  var routeName = 'receive';
  if (options && options.routeName) {
    routeName = options.routeName;
  }

  var routePattern = new WorkerRoutePattern;
  if (options && options.routePattern) {
    routePattern = options.routePattern;
  }

  this._broker = broker;
  this._envelope = envelope;
  this._pipeline = pipeline;
  this._routeName = routeName;
  this._routePattern = routePattern;
}

Object.defineProperties(Consumer.prototype, {
  _getDeserializedMessage: {
    value: function(originalMessage) {
      var msg = {
        properties: {},
        fields: {},
        payload: this._getDeserializedPayload(originalMessage)
      };

      _.assign(msg.properties, originalMessage.properties);
      _.assign(msg.fields, originalMessage.fields);

      return msg;
    },
    enumerable: false
  },

  _getDeserializedPayload: {
    value: function(originalMessage) {
      return this._envelope.deserialize(originalMessage.content);
    },
    enumerable: false
  },

  _getData: {
    value: function(msg) {
      return this._envelope.getData(msg);
    },
    enumerable: false
  },

  _getMessageTypes: {
    value: function(msg) {
      return this._envelope.getMessageTypes(msg);
    },
    enumerable: false
  },

  _consumeCallback: {
    value: function(originalMessage) {
      var self = this;
      //Assume all the messages coming from the queue have the same
      //serialization, all the middleware can process all the messages, and
      //they all use the same envelope. Use different queues (different routeName)
      //to setup receivers for messages that need different handling.

      var msg = self._getDeserializedMessage(originalMessage);

      this._pipeline.prepare(function (eventSink){
        eventSink.on('ack', function(){
          self._broker.ack(self.route.name, originalMessage);
        });
        eventSink.on('nack', function(){
          self._broker.nack(self.route.name, originalMessage, false, true);
        });
        eventSink.on('reject', function(){
          self._broker.nack(self.route.name, originalMessage, false, false);
        });
        eventSink.on('error', function(){
          self._broker.nack(self.route.name, originalMessage, false, false);
        });
      })(msg)
        .then(function(){
          var data = self._getData(msg);
          var messageTypes = self._getMessageTypes(msg);

          //I don't think you can get here without a handler
          try {
            //Async handlers should return a promise, sync handlers shouldn't return anything
            var handlerResult = self._handler(data, messageTypes, msg);

            if (handlerResult && handlerResult.then) {

              handlerResult.then(function() {
                self._broker.ack(self.route.name, originalMessage);
              }).catch(function() {
                self._broker.nack(self.route.name, originalMessage, false, false);
              });

            } else {

              self._broker.ack(self.route.name, originalMessage);

            }
          } catch (err) {
            self._broker.nack(self.route.name, originalMessage, false, false);
          }
        });
    },
    enumerable: false
  },

  use: {
    value: function(middleware){
      this._pipeline.use(middleware);
    },
    enumerable: true
  },

  startReceiving: {
    value: function(handler) {
      assert.func(handler);

      this._handler = handler;
      var routeName = this.route.name;

      return this._broker.consume(routeName, this._consumeCallback.bind(this));
    },
    enumerable: true
  }
});
