// initial version from https://github.com/LeanKit-Labs/wascally

var AmqpChannel = require('amqplib/lib/callback_model').Channel;
var promiserFn = require('./promise-machine');

function close(channel) {
  if (channel.close) {
    channel.close();
  }
}

module.exports = {
  create: function(connection, confirm, log) {
    var method = confirm ? 'createConfirmChannel' : 'createChannel';
    log.info(`Creating channel using ${method}`);
    var factory = function() {
      if (connection.state === 'released') {
        connection.acquire();
      }
      return connection[method]();
    };
    var promise = promiserFn(factory, AmqpChannel, close, 'close', log);
    connection.on('releasing', function() {
      promise.release();
    });
    return promise;
  }
};
