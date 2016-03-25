'use strict';
// initial version from https://github.com/LeanKit-Labs/wascally

const AmqpChannel = require('amqplib/lib/callback_model').Channel;
const MachineFactory = require('./machine-factory');

function close(channel) {
  if (channel.close) {
    channel.close();
  }
}

/**
 * Creates an amqp channel state machine that handles connection state changes.
 * @param {Object} connection - the connection
 * @param {bool} confirm - should channel be a ConfirmChannel or Channel
 * @param {Object} logger - the logger
 * @returns {Object} a state machine with all of the amqplib.Channel functions exposed on it
 */
module.exports = function CreateChannelMachine(connection, confirm, logger) {
  let method = confirm ? 'createConfirmChannel' : 'createChannel';
  logger.info(`Creating channel using ${method}`);
  const factory = function() {
    if (connection.state === 'released') {
      connection.acquire();
    }
    return connection[method]();
  };
  const channelMachine = MachineFactory(factory, AmqpChannel, close, 'close', logger);
  connection.on('releasing', function() {
    channelMachine.release();
  });
  return channelMachine;
};
