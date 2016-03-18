// initial version from https://github.com/LeanKit-Labs/wascally

var _ = require('lodash');
var AckBatch = require('../ack-batch.js');
var Promise = require('bluebird');
var noOp = function() {};

module.exports = function(options, topology, log) {
  var qLog = log.scoped('queue');
  var topLog = log.scoped('topology');
  function aliasOptions(options, aliases) {
    var aliased = _.transform(options, function(result, value, key) {
      var alias = aliases[key];
      result[alias || key] = value;
    });
    return _.omit(aliased, Array.prototype.slice.call(arguments, 2));
  }

  function define(channel, options, subscriber, connectionName) {
    var valid = aliasOptions(options, {
      queuelimit: 'maxLength',
      queueLimit: 'maxLength',
      deadletter: 'deadLetterExchange',
      deadLetter: 'deadLetterExchange',
      deadLetterRoutingKey: 'deadLetterRoutingKey'
    }, 'subscribe', 'limit', 'noBatch');
    var logOpts = JSON.stringify(_.omit(options, ['name']));
    topLog.info(`Declaring queue \'${options.name}\' on connection \'${connectionName}\' with the options: ${logOpts}`);
    return channel.assertQueue(options.name, valid)
      .then(function(q) {
        if (options.limit) {
          channel.prefetch(options.limit);
        }
        if (options.subscribe) {
          subscriber();
        }
        return q;
      });
  }

  function destroy(channel, options, messages, released) {
    function finalize() {
      messages.ignoreSignal();
      channel.destroy();
      channel = undefined;
    }

    function onUnsubscribed() {
      return new Promise(function(resolve) {
        if (messages.messages.length && !released) {
          messages.once('empty', function() {
            finalize();
            resolve();
          });
        } else {
          finalize();
          resolve();
        }
      });
    }

    return unsubscribe(channel, options)
      .then(onUnsubscribed, onUnsubscribed);
  }

  function getChannel(connection) {
    return connection.createChannel(true);
  }

  function getCount(messages) {
    if (messages) {
      return messages.messages.length;
    } else {
      return 0;
    }
  }

  function getTrackedOps(raw, messages) {
    return messages.getMessageOps(raw.fields.deliveryTag);
  }

  function getUntrackedOps(channel, raw, messages) {
    messages.receivedCount += 1;
    return {
      ack: noOp,
      nack: function() {
        qLog.debug(`Nacking tag ${raw.fields.deliveryTag} on ${messages.name} - ${messages.connectionName}`);
        channel.nack({ fields: { deliveryTag: raw.fields.deliveryTag } }, false);
      },
      reject: function() {
        qLog.debug(`Rejecting tag ${raw.fields.deliveryTag} on ${messages.name} - ${messages.connectionName}`);
        channel.nack({ fields: { deliveryTag: raw.fields.deliveryTag } }, false, false);
      }
    };
  }

  function getNoBatchOps(channel, raw, messages, noAck) {
    messages.receivedCount += 1;

    var ack;
    if (noAck) {
      ack = noOp;
    } else {
      ack = function() {
        qLog.debug(`Acking tag ${raw.fields.deliveryTag} on ${messages.name} - ${messages.connectionName}`);
        channel.ack({ fields: { deliveryTag: raw.fields.deliveryTag } }, false);
      };
    }

    return {
      ack: ack,
      nack: function() {
        qLog.debug(`Nacking tag ${raw.fields.deliveryTag} on ${messages.name} - ${messages.connectionName}`);
        channel.nack({ fields: { deliveryTag: raw.fields.deliveryTag } }, false);
      },
      reject: function() {
        qLog.debug(`Rejecting tag ${raw.fields.deliveryTag} on ${messages.name} - ${messages.connectionName}`);
        channel.nack({ fields: { deliveryTag: raw.fields.deliveryTag } }, false, false);
      }
    };
  }

  function resolveTags(channel, queue, connection) {
    return function(op, data) {
      switch (op) {
        case 'ack':
          qLog.debug(`Acking tag ${raw.fields.deliveryTag} on ${messages.name} - ${messages.connectionName}`);
          return channel.ack({ fields: { deliveryTag: data.tag } }, data.inclusive);
        case 'nack':
          qLog.debug(`Nacking tag ${raw.fields.deliveryTag} on ${messages.name} - ${messages.connectionName}`);
          return channel.nack({ fields: { deliveryTag: data.tag } }, data.inclusive);
        case 'reject':
          qLog.debug(`Rejecting tag ${raw.fields.deliveryTag} on ${messages.name} - ${messages.connectionName}`);
          return channel.nack({ fields: { deliveryTag: data.tag } }, data.inclusive, false);
        default:
          return Promise.resolve(true);
      }
    };
  }

  function subscribe(channelName, channel, topology, messages, options, callback) {
    var shouldAck = !options.noAck;
    var shouldBatch = !options.noBatch;

    if (shouldAck && shouldBatch) {
      messages.listenForSignal();
    }

    qLog.info(`Starting subscription ${channelName} - ${topology.connection.name} with ${JSON.stringify(options)}`);
    return channel.consume(channelName, function(raw) {
      qLog.debug(`Received message on queue ${channelName} - ${topology.connection.name}`);
      var ops = getResolutionOperations(channel, raw, messages, options);
      try {
        callback(raw, ops);
      } catch(e) {
        qLog.error(`Error handing message on queue ${channelName} - ${topology.connection.name}`, e);
        ops.reject();
      }
    }, options)
      .then(function(result) {
        channel.tag = result.consumerTag;
        return result;
      });
  }


  function getResolutionOperations(channel, raw, messages, options) {
    if (options.noBatch) {
      return getNoBatchOps(channel, raw, messages, options.noAck);
    }

    if (options.noAck || options.noBatch) {
      return getUntrackedOps(channel, raw, messages);
    }

    return getTrackedOps(raw, messages);
  }

  function unsubscribe(channel, options) {
    if (channel.tag) {
      qLog.info(`Unsubscribing from queue ${options.name} with tag ${channel.tag}`);
      return channel.cancel(channel.tag);
    } else {
      return Promise.resolve();
    }
  }

  var channel = getChannel(topology.connection);
  var messages = new AckBatch(options.name, topology.connection.name, resolveTags(channel, options.name, topology.connection.name), log);
  var subscriber = subscribe.bind(undefined, options.name, channel, topology, messages, options);

  return {
    channel: channel,
    messages: messages,
    define: define.bind(undefined, channel, options, subscriber, topology.connection.name),
    destroy: destroy.bind(undefined, channel, options, messages),
    getMessageCount: getCount.bind(undefined, messages),
    subscribe: subscriber,
    unsubscribe: unsubscribe.bind(undefined, channel, options, messages)
  };
};
