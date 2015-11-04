'use strict';

var assert = require('assert-plus');
var Promise = require('bluebird');
var amqpUri = require('amqp-uri');

module.exports = Broker;

/**
 * Handles connection and channel communication with RabbitMQ
 *
 * @public
 * @constructor
 * @param {Object} amqp - injected amqplib implementation
 * @param {String} serviceDomainName - your service's domain name, i.e. "integration-hub"
 * @param {String} appName - your service's app name, i.e. "unit-details-api"
 * @param {Object} connectionInfo - connection info to be passed to amqp-uri
 * @param {String} connectionInfo.host - host name
 * @param {String} connectionInfo.vhost - vhost (default /)
 * @param {String} connectionInfo.user - user name (default guest)
 * @param {String} connectionInfo.pass - password (default guest)
 * @param {Object} logger - the logger
 */
function Broker(amqp, serviceDomainName, appName, connectionInfo, logger) {
  assert.object(amqp, 'amqp');
  assert.string(serviceDomainName, 'serviceDomainName');
  assert.string(appName, 'appName');
  assert.object(connectionInfo, 'connectionInfo');
  assert.object(logger, 'logger');

  this._amqp = amqp;

  this._serviceDomainName = serviceDomainName;
  this._appName = appName;
  this._connectionInfo = connectionInfo;
  this._logger = logger;

  this._connection = null;
  this._routes = {};
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

      return self._assertRoute(routeName).then(function(route) {
        var exchangeName = route.exchangeName;

        self._logger.debug('Publishing message to exchange ' + exchangeName + ' with routing key ' + routingKey);
        var published = route.channel.publish(exchangeName, routingKey, content, options);

        if (published) {
          return Promise.resolve();
        } else {
          self._logger.debug('Publish failed - assume the write buffer is full.');
          return Promise.reject(new Error('Could not publish because the channel\'s write buffer was full.'));
        }
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
   * @param {String} options - consuming options - passed to amqplib
   * @returns {Promise} a promise representing the result of the consume call
   */
  consume: {
    value: function(routeName, callback, options) {
      var self = this;

      return self._assertRoute(routeName).then(function(route) {
        var queueName = route.queueName;

        self._logger.debug('Beginning consumption from queue ' + queueName);
        return route.channel.consume(queueName, callback, options).then(/* strip result from promise */);
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
      if (this._connection) {
        this._connection.close();
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
   * Create a new connection with the broker's configuration
   *
   * @private
   * @method
   * @memberOf Broker.prototype
   * @returns {Promise} a promise that is fulfilled with the resulting connection
   */

  _createConnection: {
    value: function() {
      var self = this;

      if (self._connection) {
        return Promise.resolve(self._connection);
      } else {
        var connectionString = amqpUri(self._connectionInfo);
        this._logger.info('Connecting to ' + connectionString);
        return self._amqp.connect(connectionString).then(function(conn) {
          self._connection = conn;
          return conn;
        }).catch(function(err){
          self._logger.error('Failed to connect to ' + connectionString, err);
          return Promise.reject(err);
        });
      }
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
   * @returns {Promise} a promise that is fulfilled with the resulting route (result has exchangeName or queueName, and channel properties)
   */
  _assertRoute: {
    value: function(routeName) {
      var self = this;

      var route = self._routes[routeName];
      var newChannel;

      if (route.channel) {
        return Promise.resolve(route);
      } else {
        return self._createConnection().then(function(conn) {
          return conn.createChannel();
        }).then(function(channel) {
          newChannel = channel;
          self._logger.debug('Asserting route ' + routeName);
          return route.pattern.assertRoute(self._serviceDomainName, self._appName, routeName, channel);
        }).then(function(topologyNames) {
          route.exchangeName = topologyNames.exchangeName;
          route.queueName = topologyNames.queueName;
          route.channel = newChannel;

          self._logger.debug('Route ' + routeName + ' asserted');
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
