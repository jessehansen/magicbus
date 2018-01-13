const delay = (ms) => new Promise((res) => setTimeout(res, ms))
const tick = () => new Promise((res) => process.nextTick(res))

module.exports = { delay, tick }
