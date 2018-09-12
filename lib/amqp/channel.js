// initial version from https://github.com/LeanKit-Labs/wascally

const AmqpChannel = require('amqplib/lib/callback_model').Channel
const MachineFactory = require('./machine-factory')

const close = (channel) => channel.close && channel.close()

const ChannelMachine = (connection, confirm, logger) => {
  let method = confirm ? 'createConfirmChannel' : 'createChannel'
  let log = logger.withNamespace('channel')
  logger.silly(`Creating channel using ${method}`)
  const factory = () => {
    if (connection.state === 'released') {
      connection.acquire()
    }
    return connection[method]()
  }
  const channelMachine = MachineFactory(factory, AmqpChannel, close, 'close', ['ack', 'nack', 'reject'], log)
  connection.on('releasing', () => channelMachine.release())
  return channelMachine
}

module.exports = ChannelMachine
