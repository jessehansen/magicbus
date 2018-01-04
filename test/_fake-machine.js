const Monologue = require('monologue.js')

const Machine = (fail) => {
  const emitter = new Monologue()

  setTimeout(fail ? () => emitter.emit('failed') : () => emitter.emit('defined'), 0)

  return emitter
}

module.exports = () => Machine()
module.exports.fail = () => Machine(true)
