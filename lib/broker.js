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

  _assertRoute: {
    value: function(routeName) {
      var self = this;

      return new Promise(function(resolve, reject) {
        var route = self._routes[routeName];
        if (route.channel) {
          resolve(route);
        } else {
          self._createConnection().then(function(conn) {
            conn.createChannel().then(function(channel) {

              switch (self._routes[routeName].pattern) {
                case 'topic-publisher':
                  var topicPublisherExchangeName = self._appName + '.' + routeName;

                  channel.assertExchange(topicPublisherExchangeName, 'topic', {
                    durable: true
                  });

                  route.exchangeName = topicPublisherExchangeName;
                  route.channel = channel;
                  resolve(route);

                  break;

                case 'worker':
                  var workerQueueName = self._appName + '.' + routeName;
                  var workerDeadLetterExchangeName = workerQueueName + '.failed';
                  var workerFailedQueueName = workerQueueName + '.failed';

                  channel.assertExchange(workerDeadLetterExchangeName, 'fanout', {
                    durable: true
                  }).then(function() {
                    var workerFailedQueueOptions = null;
                    channel.assertQueue(workerFailedQueueName, workerFailedQueueOptions);
                  }).then(function() {
                    channel.bindQueue(workerFailedQueueName, workerDeadLetterExchangeName, '');
                  }).then(function() {
                    var workerQueueOptions = {
                      deadLetterExchange: workerDeadLetterExchangeName
                    };
                    channel.assertQueue(workerQueueName, workerQueueOptions).then(function(q) {
                      route.queueName = workerQueueName;
                      route.channel = channel;
                      resolve(route);
                    });
                  });

                  break;

                case 'listener':
                  var listenerExchangeName = self._appName + '.' + routeName;
                  channel.assertExchange(listenerExchangeName, 'fanout', {
                    durable: true
                  });

                  var listenerQueueOptions = {
                    exclusive: true
                  };

                  channel.assertQueue('', listenerQueueOptions).then(function(q) {
                    channel.bindQueue(q.queue, listenerExchangeName, '');

                    route.queueName = q.queue;
                    route.channel = channel;
                    resolve(route);
                  });
                  break;
              }
            });
          });
        }
      });
    },
    enumerable: false
  }

});