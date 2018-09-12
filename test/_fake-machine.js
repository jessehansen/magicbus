const Monologue = require('monologue.js')

const Machine = (fail) => {
  const emitter = new Monologue()

  setTimeout(fail ? () => emitter.emit('failed', new Error('Nuts!')) : () => emitter.emit('defined'), 0)

  return emitter
}

module.exports = () => Machine(false)
module.exports.fails = () => Machine(true)
module.exports.hangs = () => new Monologue()
