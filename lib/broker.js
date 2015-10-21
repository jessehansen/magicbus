'use strict';

var assert = require('assert-plus');
var Promise = require('bluebird');
var amqpUri = require('amqp-uri');

module.exports = Broker;

function Broker(serviceDomainName, appName, connectionInfo) {
  assert.string(serviceDomainName, 'serviceDomainName');
  assert.string(appName, 'appName');
  assert.object(connectionInfo, 'connectionInfo');

  //Hold a reference on the instance so it can be replaced by a mock in tests
  this._amqp = require('amqplib');

  this._serviceDomainName = serviceDomainName;
  this._appName = appName;
  this._connectionInfo = connectionInfo;

  this._connection = null;
  this._channels = {};
  this._routes = {};
}

Object.defineProperties(Broker.prototype, {
  registerRoute: {
    value: function(name, pattern) {
      this._routes[name] = {
        pattern: pattern
      };
    },
    enumerable: true
  },

  getRoutePattern: {
    value: function(routeName) {
      return this._routes[routeName].pattern;
    },
    enumerable: true
  },

  publish: {
    value: function(routeName, routingKey, content, options) {
      var self = this;

      return new Promise(function(resolve, reject) {
        self._assertRoute(routeName).then(function(route) {
          var exchangeName = route.exchangeName;

          var published = route.channel.publish(exchangeName, routingKey, content, options);

          if (published) {
            resolve();
          } else {
            reject(new Error('Could not publish because the channel\'s write buffer was full.'));
          }
        });
      });
    },
    enumerable: true
  },

  consume: {
    value: function(routeName, callback, options) {
      var self = this;

      return new Promise(function(resolve, reject) {
        self._assertRoute(routeName).then(function(route) {
          var queueName = route.queueName;

          route.channel.consume(queueName, callback, options).then(function(consumerTag) {
            resolve();
          });
        });
      });
    },
    enumerable: true
  },

  ack: {
    value: function(routeName, message) {
      var self = this;

      return new Promise(function(resolve, reject) {
        self._assertRoute(routeName).then(function(route) {
          route.channel.ack(message);
          resolve();
        });
      });
    },
    enumerable: true
  },

  nack: {
    value: function(routeName, message, allUpTo, requeue) {
      var self = this;

      return new Promise(function(resolve, reject) {
        self._assertRoute(routeName).then(function(route) {
          route.channel.nack(message, allUpTo, requeue);
          resolve();
        });
      });
    },
    enumerable: true
  },

  shutdown: {
    value: function() {
      if (this._connection) {
        this._connection.close();
      }
    },
    enumerable: true
  },

  _createConnection: {
    value: function() {
      var self = this;

      return new Promise(function(resolve, reject) {
        if (self._connection) {
          return resolve(self._connection);
        } else {
          var connectionString = amqpUri(self._connectionInfo);
          self._amqp.connect(connectionString).then(function(conn) {
            self._connection = conn;
            resolve(conn);
          });
        }
      });
    },
    enumerable: false
  },

  _assertRoute: {
    value: function(routeName) {
      var self = this;

      var route = self._routes[routeName];
      var newChannel;

      if (route.channel) {
        return Promise.resolve(route);
      } else {
        return Promise.resolve().then(function() {
          return self._createConnection();
        }).then(function(conn) {
          return conn.createChannel();
        }).then(function(channel) {
          newChannel = channel;
          return route.pattern.assertRoute(self._serviceDomainName, self._appName, routeName, channel);
        }).then(function(topologyNames) {
          route.exchangeName = topologyNames.exchangeName;
          route.queueName = topologyNames.queueName;
          route.channel = newChannel;

          return route;
        });
      }
    },
    enumerable: false
  }

});