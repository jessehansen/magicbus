const Context = require('./context')

const PublishContext = Context((i) => ({
  error: (err) => i.emit('error', err)
}))

module.exports = PublishContext
