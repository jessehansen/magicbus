const Context = require('./context')

const ConsumeContext = Context((i) => ({
  error: (err) => i.emit('error', err)
}))

module.exports = ConsumeContext
