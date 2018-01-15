const Context = require('./context')

const ConsumeContext = Context((i) => ({
  ack: () => i.outcome('ack'),
  nack: () => i.outcome('nack'),
  reject: () => i.outcome('reject'),

  error: (err) => i.emit('error', err)
}))

module.exports = ConsumeContext
