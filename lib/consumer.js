'use strict';

var assert = require('assert-plus');
var _ = require('lodash');

module.exports = Consumer;

/**
 * Handles general-purpose consumption of messages from the bus
 *
 * @public
 * @constructor
 * @param {Object} broker - instance of the {@link Broker} class
 * @param {Object} options
 * @param {Object} options.envelope - instance of the {@link AbstractEnvelope} class
 * @param {Object} options.pipeline - instance of the {@link Middleware.Pipeline} class
 * @param {String} options.routeName - route name (default "receive")
 * @param {Object} options.routePattern - route pattern (default {@link WorkerRoutePattern})
 * @param {Object} logger - the logger
 */
function Consumer(broker, envelope, pipeline, routeName, routePattern, logger) {
  assert.object(broker, 'broker');
  assert.object(envelope, 'envelope');
  assert.object(pipeline, 'pipeline');
  assert.string(routeName, 'routeName');
  assert.object(routePattern, 'routePattern');
  assert.object(logger, 'logger');

  this._broker = broker;
  this._envelope = envelope;
  this._pipeline = pipeline;
  this._routeName = routeName;
  this._routePattern = routePattern;
  this._logger = logger;
  this._consuming = false;

  this._broker.registerRoute(this._routeName, this._routePattern);
}

Object.defineProperties(Consumer.prototype, {
  /**
   * Deserialize a message
   *
   * @private
   * @method
   * @memberOf Consumer.prototype
   * @param {Object} originalMessage - message to be deserialized
   * @returns {Object} deserialized message
   */
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

  /**
   * Deserialize a message's payload by calling the envelope
   *
   * @private
   * @method
   * @memberOf Consumer.prototype
   * @param {Object} originalMessage - message to be deserialized
   * @returns {Any} deserialized payload
   */
  _getDeserializedPayload: {
    value: function(originalMessage) {
      return this._envelope.deserialize(originalMessage.content);
    },
    enumerable: false
  },

  /**
   * Get data from a message by calling the envelope
   *
   * @private
   * @method
   * @memberOf Consumer.prototype
   * @param {Object} msg - message to retrieve data from
   * @returns {Any} data
   */
  _getData: {
    value: function(msg) {
      return this._envelope.getData(msg);
    },
    enumerable: false
  },

  /**
   * Get all of a message's types by calling the envelope
   *
   * @private
   * @method
   * @memberOf Consumer.prototype
   * @param {Object} msg - message to get types from
   */
  _getMessageTypes: {
    value: function(msg) {
      return this._envelope.getMessageTypes(msg);
    },
    enumerable: false
  },

  /**
   * Callback for message consumption
   *
   * @private
   * @method
   * @memberOf Consumer.prototype
   * @param {Object} originalMessage - message consumed from the queue
   */
  _consumeCallback: {
    value: function(originalMessage, ops) {
      var self = this;
      //Assume all the messages coming from the queue have the same
      //serialization, all the middleware can process all the messages, and
      //they all use the same envelope. Use different queues (different routeName)
      //to setup consumers for messages that need different handling.

      var messageHandled = false;

      this._pipeline.clone().use(function(msg, actions) {
        self._logger.debug('Received message from queue');

        var data = self._getData(msg);
        var messageTypes = self._getMessageTypes(msg);

        //I don't think you can get here without a handler
        try {
          //Async handlers should return a promise, sync handlers shouldn't return anything
          var handlerResult = self._handler(data, messageTypes, msg, actions);

          if (handlerResult && handlerResult.then) {
            handlerResult.then(function() {
              actions.next();
            }).catch(function(err) {
              self._logger.error('Asynchronous handler failed.', err);
              actions.reject();
            });

          } else {
            actions.next();
          }
        } catch (err) {
          self._logger.error('Synchronous handler failed with error.', err);
          actions.reject();
        }
      }).prepare(function(eventSink) {
        eventSink.on('ack', function() {
          self._logger.info('Middleware acked message');
          messageHandled = true;
          ops.ack();
        });
        eventSink.on('nack', function() {
          self._logger.info('Middleware nacked message');
          messageHandled = true;
          ops.nack();
        });

        eventSink.on('reject', function() {
          self._logger.info('Middleware rejected message');
          messageHandled = true;
          ops.reject();
        });
        eventSink.on('error', function(err) {
          self._logger.warn('Middleware raised error', err);
          messageHandled = true;
          ops.reject();
        });
      })(self._getDeserializedMessage(originalMessage))
      .then(function() {
        if (!messageHandled) {
          ops.ack();
        }
      }).catch(function(err) {
        self._logger.warn('Message consumption failed.', err);
        if (!messageHandled) {
          ops.reject();
        }
      });
    },
    enumerable: false
  },

  /**
   * Use a middleware function
   *
   * @public
   * @method
   * @memberOf Consumer.prototype
   * @param {Function} middleware - middleware to run {@see middleware.contract}
   */
  use: {
    value: function(middleware) {
      this._pipeline.use(middleware);
    },
    enumerable: true
  },

  /**
   * Start consuming messages from the queue
   *
   * @public
   * @method
   * @memberOf Consumer.prototype
   * @param {Consumer.handlerCallback} handler - message handler
   */
  startConsuming: {
    value: function(handler) {
      assert.func(handler);
      if (this._consuming) {
        this._logger.error('Attempted to start consuming on a consumer that was already active');
        assert.fail('Already consuming');
      }

      this._consuming = true;
      this._handler = handler;
      var routeName = this._routeName;

      this._logger.info('Begin consuming messages');
      return this._broker.consume(routeName, this._consumeCallback.bind(this));
    },
    enumerable: true
  },

  /**
   * Gets the route being used for consuming
   *
   * @public
   * @method
   * @memberOf Consumer.prototype
   * @returns {Object} details of the route
   */
  getRoute: {
    value: function() {
      var brokerRoute = this._broker.getRouteParams();
      brokerRoute.name = this._routeName;
      brokerRoute.pattern = this._routePattern;
      return brokerRoute;
    },
    enumerable: true
  }
});

/**
 * Message consumption callback
 * @callback handlerCallback
 * @memberOf Consumer
 * @param {Object} data - unpacked data
 * @param {Array} messageTypes - unpacked message types
 * @param {Object} message - raw message
 */
