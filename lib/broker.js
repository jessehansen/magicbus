'use strict';

var assert = require('assert-plus');
var Promise = require('bluebird');

module.exports = Broker;

function Broker(appName, connectionInfo) {
  assert.string(appName, 'appName');
  assert.object(connectionInfo, 'connectionInfo');

  //Hold a reference on the instance so it can be replaced by a mock in tests
  this._amqp = require('amqplib');

  this._appName = appName;
  this._connectionInfo = connectionInfo;

  this._connection = null;
  this._channels = {};
}

Object.defineProperties(Broker.prototype, {
  publish: {
    value: function(routeName, routingKey, content, options) {
      var self = this;

      return new Promise(function(resolve, reject) {
        //Shouldn't really be creating a connection and channel each time.
        //Need to implement the connection/channel management stuff like event-messenger
        self._createChannel(routeName).then(function(ch) {
          var exchangeName = self._appName + '.' + routeName;

          ch.assertExchange(exchangeName, 'topic', {
            durable: true
          }).then(function() {
            var published = ch.publish(exchangeName, routingKey, content, options);

            if (published) {
              resolve();
            } else {
              reject(new Error('Could not publish because the channel\'s write buffer was full.'));
            }
          });
        });
      });
    },
    enumerable: true
  },

  consume: {
    value: function(routeName, callback, options) {
      var self = this;

      return new Promise(function(resolve, reject) {
        self._createChannel(routeName).then(function(ch) {
          var queueName = self._appName + '.' + routeName;

          var queueOptions = null;
          ch.assertQueue(queueName, queueOptions).then(function(q) {
            ch.consume(q.queue, callback, options).then(function(consumerTag) {
              resolve();
            });
          });
        });
      });
    },
    enumerable: true
  },

  ack: {
    value: function(routeName, msg) {
      var self = this;

      return new Promise(function(resolve, reject) {
        self._createChannel(routeName).then(function(channel) {
          channel.ack(msg);
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
          var connectionString = 'amqp://' + self._connectionInfo.user + ':' + self._connectionInfo.pass + '@' + self._connectionInfo.server + self._connectionInfo.vhost;
          self._amqp.connect(connectionString).then(function(conn) {
            self._connection = conn;
            resolve(conn);
          });
        }
      });
    },
    enumerable: false
  },

  _createChannel: {
    value: function(routeName) {
      var self = this;

      return new Promise(function(resolve, reject) {
        if (self._channels[routeName]) {
          resolve(self._channels[routeName]);
        } else {
          self._createConnection().then(function(conn) {
            conn.createChannel().then(function(channel) {
              self._channels[routeName] = channel;
              resolve(channel);
            });
          });
        }
      });
    },
    enumerable: false
  }

});