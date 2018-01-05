const assert = require('assert-plus')

module.exports = {
  assertObjectOrFunction (item, param) {
    if (typeof (item) === 'function') {
      return
    }
    assert.object(item, param)
  },
  assertStringOrFunction (item, param) {
    if (typeof (item) === 'function') {
      return
    }
    assert.string(item, param)
  },
  createFactoryFunction (item) {
    if (typeof (item) !== 'function') {
      return function () {
        return item
      }
    }
    return item
  }
}

