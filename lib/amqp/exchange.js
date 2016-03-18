// initial version from https://github.com/LeanKit-Labs/wascally

var _ = require('lodash');
var Promise = require('bluebird');

module.exports = function(options, topology, publishLog, log) {
  var exLog = log.scoped('exchange');
  var topLog = log.scoped('topology');

  function aliasOptions(options, aliases) {
    var aliased = _.transform(options, function(result, value, key) {
      var alias = aliases[ key ];
      result[ alias || key ] = value;
    });
    return _.omit(aliased, Array.prototype.slice.call(arguments, 2));
  }

  function define(channel, options, connectionName) {
    var valid = aliasOptions(options, {
      alternate: 'alternateExchange'
    }, 'persistent', 'publishTimeout');
    var logOpts = JSON.stringify(_.omit(valid, ['name', 'type']));
    topLog.info(`Declaring ${options.type} exchange \'${options.name}\' on connection \'${connectionName}\' with the options: ${logOpts}`);
    return channel.assertExchange(options.name, options.type, valid);
  }

  function getChannel(connection) {
    return connection.createChannel(true);
  }

  function publish(channel, options, topology, log, message) {
    var channelName = options.name;
    var type = options.type;
    var payload = message.payload;
    var publishOptions = {
      type: message.type || '',
      contentType: message.contentType,
      contentEncoding: message.contentEncoding,
      correlationId: message.correlationId || '',
      replyTo: message.replyTo || '',
      messageId: message.messageId || message.id || '',
      timestamp: message.timestamp,
      appId: message.appId || '',
      headers: message.headers || {},
      expiration: message.expiresAfter || undefined
    };
    if (publishOptions.replyTo === 'amq.rabbitmq.reply-to') {
      publishOptions.headers['direct-reply-to'] = 'true';
    }
    if (options.persistent) {
      publishOptions.persistent = true;
    }

    var effectiveKey = message.routingKey === '' ? '' : message.routingKey || publishOptions.type;
    exLog.debug(`Publishing message (type: ${publishOptions.type} topic: ${effectiveKey}, sequence: ${message.sequenceNo}, correlation: ${publishOptions.correlationId}, replyTo: ${JSON.stringify(publishOptions)}) to ${type} exchange ${channelName} - ${topology.connection.name}`);

    return channel.publish(
        channelName,
        effectiveKey,
        payload,
        publishOptions);
  }

  var channel = getChannel(topology.connection);
  return {
    channel: channel,
    define: define.bind(undefined, channel, options, topology.connection.name),
    destroy: function() {
      if (channel) {
        channel.destroy();
        channel = undefined;
      }
      return Promise.resolve(true);
    },
    publish: publish.bind(undefined, channel, options, topology, publishLog)
  };
};
