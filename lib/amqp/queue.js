'use strict';
// initial version from https://github.com/LeanKit-Labs/wascally

const _ = require('lodash');
const AckBatch = require('../ack-batch.js');
const Promise = require('bluebird');
const noOp = function() {};

//todo: support subscribe options for noBatch, gather & document queue options

module.exports = function(options, topology, log) {
  let qLog = log.scoped('queue');
  let topLog = log.scoped('topology');

  let channel = topology.connection.createChannel(true);
  let channelName = options.name;
  let connectionName = topology.connection.name;

  const resolver = (op, data) => {
    switch (op) {
    case 'ack':
      qLog.debug(`Acking tag ${data.tag} on ${channelName} - ${connectionName}`);
      return channel.ack({ fields: { deliveryTag: data.tag } }, data.inclusive);
    case 'nack':
      qLog.debug(`Nacking tag ${data.tag} on ${channelName} - ${connectionName}`);
      return channel.nack({ fields: { deliveryTag: data.tag } }, data.inclusive);
    case 'reject':
      qLog.debug(`Rejecting tag ${data.tag} on ${channelName} - ${connectionName}`);
      return channel.nack({ fields: { deliveryTag: data.tag } }, data.inclusive, false);
    default:
      return Promise.resolve(true);
    }
  };

  let messages = AckBatch(channelName, connectionName, resolver, log);

  /**
   * Get options for amqp assertQueue call
   * @private
   */
  function getLibOptions(aliases, itemsToOmit) {
    var aliased = _.transform(options, function(result, value, key) {
      var alias = aliases[key];
      result[alias || key] = value;
    });
    return _.omit(aliased, itemsToOmit);
  }

  /**
   * Purge message queue. Useful for testing
   * @public
   */
  function purge() {
    qLog.debug(`Purging queue ${channelName} - ${connectionName}`);
    return channel.purgeQueue(channelName).then(function(){
      qLog.debug(`Successfully purged queue ${channelName} - ${connectionName}`);
    });
  }

  /**
   * Get unresolved message count
   * @public
   */
  function getMessageCount() {
    if (messages) {
      return messages.messages.length;
    }
    return 0;
  }

  /**
   * Get message operations for a tracked & batched queue
   * @private
   */
  function getTrackedOps(raw) {
    return messages.getMessageOps(raw.fields.deliveryTag);
  }

  /**
   * Get message operations for an untracked queue
   * @private
   */
  function getUntrackedOps(raw) {
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

  /**
   * Get message operations for an unbatched queue
   * @private
   */
  function getNoBatchOps(raw) {
    var ack;
    messages.receivedCount += 1;

    if (options.noAck) {
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

  /**
   * Get message operations
   * @private
   */
  function getResolutionOperations(raw) {
    if (options.noBatch) {
      return getNoBatchOps(raw);
    }

    if (options.noAck) {
      return getUntrackedOps(raw);
    }

    return getTrackedOps(raw);
  }

  /**
   * Subscribe to the queue's messages
   * @public
   * @param {Function} callback - the function to call for each message received from queue. Should have signature function (message, operations) where operations contains ack, nack, and reject functions
   */
  function subscribe(callback) {
    var shouldAck = !options.noAck;
    var shouldBatch = !options.noBatch;

    if (shouldAck && shouldBatch) {
      messages.listenForSignal();
    }

    qLog.info(`Starting subscription ${channelName} - ${connectionName} with ${JSON.stringify(options)}`);
    return channel.consume(channelName, function(raw) {
      var ops = getResolutionOperations(raw);
      qLog.debug(`Received message on queue ${channelName} - ${connectionName}`);

      if (shouldAck && shouldBatch) {
        messages.addMessage(ops.message);
      }

      try {
        callback(raw, ops);
      } catch(e) {
        qLog.error(`Error handing message on queue ${channelName} - ${connectionName}`, e);
        ops.reject();
      }
    }, options)
      .then(function(result) {
        channel.tag = result.consumerTag;
        return result;
      });
  }

  /**
   * Unsubscribe from the queue (stop calling the message handler)
   * @public
   */
  function unsubscribe(channel) {
    if (channel.tag) {
      qLog.info(`Unsubscribing from queue ${channelName} with tag ${channel.tag}`);
      return channel.cancel(channel.tag);
    }
    return Promise.resolve();
  }

  /**
   * Define the queue
   * @public
   */
  function define() {
    let libOptions = getLibOptions(options, {
      queuelimit: 'maxLength',
      deadletter: 'deadLetterExchange',
      deadLetterRoutingKey: 'deadLetterRoutingKey'
    }, ['subscribe', 'limit', 'noBatch']);
    topLog.info(`Declaring queue \'${channelName}\' on connection \'${connectionName}\' with the options: ${JSON.stringify(_.omit(options, ['name']))}`);
    return channel.assertQueue(channelName, libOptions)
      .then(function(q) {
        if (options.limit) {
          channel.prefetch(options.limit);
        }
        return q;
      });
  }

  /**
   * Destroy the queue
   * @public
   */
  function destroy(released) {
    function flush() {
      if (messages.messages.length && !released) {
        return messages.flush();
      }
      return Promise.resolve();
    }

    function finalize() {
      messages.ignoreSignal();
      channel.destroy();
      channel = undefined;
    }

    return flush().then(function(){
      return unsubscribe(channel, options);
    }).then(finalize, finalize);
  }

  return {
    channel: channel,
    messages: messages,
    define: define,
    destroy: destroy,
    getMessageCount: getMessageCount,
    subscribe: subscribe,
    unsubscribe: unsubscribe.bind(undefined, channel, messages),
    purge: purge.bind(undefined, channel, connectionName)
  };
};
