'use strict';

var assert = require('assert-plus');
var Promise = require('bluebird');
var Connection = require('./connection-machine');
var Topology = require('./topology');
var _ = require('lodash');

var unhandledStrategies = {
  nackOnUnhandled: function(message) {
    message.nack();
  },
  rejectOnUnhandled: function(message) {
    message.reject();
  },
  customOnUnhandled: function() {}
};
unhandledStrategies.onUnhandled = unhandledStrategies.nackOnUnhandled;

module.exports = Broker;

/**
 * Handles connection and channel communication with RabbitMQ
 *
 * @public
 * @constructor
 * @param {Object} amqp - injected amqplib implementation
 * @param {String} serviceDomainName - your service's domain name, i.e. "integration-hub"
 * @param {String} appName - your service's app name, i.e. "unit-details-api"
 * @param {Object|String} connectionInfo - connection info to be passed to amqplib's connect method
 * @param {String} connectionInfo.hostname - host name
 * @param {String} connectionInfo.vhost - vhost (default /)
 * @param {String} connectionInfo.username - user name (default guest)
 * @param {String} connectionInfo.password - password (default guest)
 * @param {Object} logger - the logger
 */
function Broker(amqp, serviceDomainName, appName, connectionInfo, logger) {
  assert.object(amqp, 'amqp');
  assert.string(serviceDomainName, 'serviceDomainName');
  assert.string(appName, 'appName');
  if (typeof(connectionInfo) !== 'string') {
    assert.object(connectionInfo, 'connectionInfo');
  }
  assert.object(logger, 'logger');

  this._amqp = amqp;
  this._serviceDomainName = serviceDomainName;
  this._appName = appName;
  this._connectionInfo = connectionInfo;
  this._logger = logger;

  this._topology = null;
  this._routes = {};
  this._consumers = [];
  this._closed = false;
}

Object.defineProperties(Broker.prototype, {
  /**
   * Registers a new route with a name and a pattern
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @param {String} name - the name of the route
   * @param {Object} pattern - the RoutePattern that defines the route's pattern
   */
  registerRoute: {
    value: function(name, pattern) {
      this._routes[name] = {
        pattern: pattern
      };
    },
    enumerable: true
  },

  /**
   * Get the route pattern for the given route name
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route
   * @returns {Object} the RoutePattern for the given route name
   */
  getRoutePattern: {
    value: function(routeName) {
      return this._routes[routeName].pattern;
    },
    enumerable: true
  },

  /**
   * Publish a message using the given parameters
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route
   * @param {String} routingKey - the message's routing key
   * @param {String} content - messageContent
   * @param {String} options - publishing options - passed to amqplib
   * @returns {Promise} a promise representing the result of the publish call
   */
  publish: {
    value: function(routeName, routingKey, content, options) {
      var self = this;

      return self._getExchange(routeName).then(function(exchange) {
        self._logger.debug('Publishing message to exchange ' + exchange.name + ' with routing key ' + routingKey);
        var msg = _.extend({
          routingKey: routingKey,
          payload: content
        }, options);
        return exchange.publish(msg);
      });
    },
    enumerable: true
  },


  /**
   * Start consuming messages on the given route
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route
   * @param {Function} callback - function to be called with each message consumed
   * @returns {Promise} a promise representing the result of the consume call
   */
  consume: {
    value: function(routeName, callback) {
      var self = this;
      return self._getQueue(routeName).then(function(queue) {
        self._logger.debug('Beginning consumption from queue ' + queue.name);
        return queue.subscribe(callback).then(/* strip result from promise */);
      });
    },
    enumerable: true
  },

  /**
   * Acknowledge that a message has been consumed
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route
   * @param {Object} message - the message to ack
   * @returns {Promise} a promise representing the result of the ack call
   */
  ack: {
    value: function(routeName, message) {
      var self = this;

      return self._assertRoute(routeName).then(function(route) {
        self._logger.debug('ACK: ' + JSON.stringify(message.properties));
        route.channel.ack(message);
      });
    },
    enumerable: true
  },

  /**
   * Notify RabbitMQ that a message was not successfully processed
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route
   * @param {Object} message - the message to nack
   * @param {Bool} allUpTo - if true, nacks all unacknowledged messages up to this one
   * @param {Bool} requeue - if true, requeue the message for consumption
   * @returns {Promise} a promise representing the result of the nack call
   */
  nack: {
    value: function(routeName, message, allUpTo, requeue) {
      var self = this;

      return self._assertRoute(routeName).then(function(route) {
        self._logger.debug('NACK' + (requeue? '+requeue' : '-requeue') + ': ' + JSON.stringify(message.properties));
        route.channel.nack(message, allUpTo, requeue);
      });
    },
    enumerable: true
  },


  /**
   * Close the connection and all associated channels
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   */
  shutdown: {
    value: function() {
      this._logger.info('Shutting down broker connection');
      if (this._topology) {
        this._closed = true;
        this._topology.connection.close();
        this._topology = null;
      }
    },
    enumerable: true
  },


  /**
   * Gets the route params that are set by the broker
   *
   * @public
   * @method
   * @memberOf Broker.prototype
   * @returns {Object} details of the route
   */
  getRouteParams: {
    value: function(){
      return {
        serviceDomainName:this._serviceDomainName,
        appName:this._appName
      };
    },
    enumerable: true
  },

  /**
   * Checks to see if a connection is established.
   *
   * @public
   * @method
   * @memberof Broker.prototype
   * @returns {Boolean} status of the connection
   */
  isConnected:{
    value: function(){
      return !!this._topology && !this._closed;
    }
  },

  /**
   * Retrieves the open channel for a given route
   *
   * @public
   * @method
   * @memberof Broker.prototype
   * @param {String} routeName - the name of the route
   * @returns {Channel} amqplib's channel for the route
   */
  getChannel: {
    value: function(routeName) {
      return this._assertRoute(routeName)
        .then(function (route) {
          return route.channel;
        });
    }
  },

  /**
   * Ensures that a connection exists.
   *
   * @method
   * @memberOf Broker.prototype
   * @returns {Promise} a promise that is fulfilled with the resulting connection
   */

  connect: {
    value: function() {
      var self = this;
      if (self._closed) {
        throw new Error('Broker is shut down, no more connections allowed.');
      }
      if (!this._topology) {
        self._logger.info('Connecting');
        var connectionOptions = _.extend({
          name: this._serviceDomainName + '.' + this._appName
        }, this._connectionInfo);
        var connection = Connection(connectionOptions);
        var topology = Topology(connection, this._connectionInfo || {}, unhandledStrategies);
        connection.on('connected', function(state) {
          connection.uri = state.item.uri;
          self._logger.info('Connected to ' + state.item.uri + ' Successfully');
          self.eventSink.emit('connected', connection);
        });
        connection.on('closed', function() {
          self.eventSink.emit('closed', connection);
        });
        connection.on('failed', function(err) {
          self.eventSink.emit('failed', connection);
          self._logger.error('Error connecting', err);
        });
        this._topology = topology;
      }
      return this._topology;
    },
    enumerable: false
  },

  /**
   * Gets the exchange channel for a given route
   *
   * @method
   * @private
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route the exchange is on
   * @returns {Channel} the channel
   */

  _getExchange: {
    value: function(routeName) {
      var self = this;
      self.connect();
      return self._assertRoute(routeName)
        .then(function(route){
          var exchangeName = route.exchangeName;
          return self._topology.channels['exchange:' + exchangeName];
        });
    },
    enumerable: false
  },

  /**
   * Gets the queue channel for a given route
   *
   * @method
   * @private
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route the exchange is on
   * @returns {Channel} the channel
   */

  _getQueue: {
    value: function(routeName) {
      var self = this;
      self.connect();
      return self.assertRoute(routeName)
        .then(function(route){
          var queueName = route.queueName;
          return self._topology.channels['queue:' + queueName];
        });
    },
    enumerable: false
  },


  /**
   * Assert that a route is configured in RabbitMQ
   *
   * @private
   * @method
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route
   * @returns {Promise} a promise that is fulfilled with the resulting route (result has exchangeName or queueName)
   */
  _assertRoute: {
    value: function(routeName) {
      var self = this;

      var route = self._routes[routeName];

      if (route.asserted) {
        return route;
      } else {
        self.connect();
        self._logger.debug('Asserting route ' +  routeName);
        return route.pattern.assertRoute(self._topology, self._serviceDomainName, self._appName, routeName)
        .then(function(topologyNames) {
          if (topologyNames.exchangeName) {
            route.exchangeName = topologyNames.exchangeName;
          }
          if (topologyNames.queueName) {
            route.queueName = topologyNames.queueName;
          }

          self._logger.debug('Route ' + routeName + ' asserted');
          route.asserted = true;
          return route;
        }).catch(function(err){
          self._logger.error('Failed to assert route ' + routeName, err);
          return Promise.reject(err);
        });
      }
    },
    enumerable: false
  }

});
