'use strict';

var assert = require('assert-plus');
var Promise = require('bluebird');

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

  this._connection = null;
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
      this._consumers.push({
        routeName: routeName,
        callback: callback,
        options: options
      });

      return self._consume(routeName, callback, options);
    },
    enumerable: true
  },


  /**
   * Start consuming messages on the given route
   *
   * @private
   * @method
   * @memberOf Broker.prototype
   * @param {String} routeName - the name of the route
   * @param {Function} callback - function to be called with each message consumed
   * @param {String} options - consuming options - passed to amqplib
   * @returns {Promise} a promise representing the result of the consume call
   */
  _consume: {
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
        this._closed = true;
        this._connection.removeAllListeners();
        this._connection.close();
        this._connection = null;
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
      return !!this._connection && !this._closed;
    }
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

      if (self._closed) {
        return Promise.reject(new Error('Broker is shut down, no more connections allowed.'));
      }

      if (self._connection) {
        return Promise.resolve(self._connection);
      } else {
        this._logger.info('Connecting to ' + self._connectionInfo.hostname + ':' + self._connectionInfo.port);
        return self._amqp.connect(self._connectionInfo).then(function(conn) {
          self._connection = conn;
          conn.on('close', function() {
            self._logger.info('AMQP Connection closed');
            self._maybeKillConnection();
            self._maybeReconnect();
          });
          conn.on('error', function(err) {
            self._logger.warn('AMQP Connection failed with error.', err);
            self._maybeKillConnection();
            self._maybeReconnect();
          });
          return conn;
        }).catch(function(err){
          self._logger.error('Failed to connect to ' + self._connectionInfo.hostname + ':' + self._connectionInfo.port, err);
          return Promise.reject(err);
        });
      }
    },
    enumerable: false
  },

  /**
   * Remove existing connection and channels if it's not already gone
   * @private
   */

  _maybeKillConnection: {
    value: function() {
      var self = this;
      if (!self._connection) {
        return;
      }
      for (var routeName in self._routes) {
        self._routes[routeName].channel = null;
      }
      self._connection = null;
    },
    enumerable: false
  },

  /**
   * Reconnect to amqp host if consumers are wired up
   * @private
   */

  _maybeReconnect: {
    value: function() {
      var self = this;
      if (this._consumers.length == 0 || this._reconnecting) {
        //no need to reconnect
        return;
      }
      this._reconnecting = true;
      Promise.map(this._consumers, function(consumer){
        self._consume(consumer.routeName, consumer.callback, consumer.options);
      }).catch(function(err){
        self._logger.error('Error when reconnecting consumers', err);
      }).finally(function(){
        self._reconnecting = false;
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
