const assert = require('assert-plus')

const jsonSerializerFactory = (encoding = 'utf8') => ({
  contentTypeSuffix: '+json',
  encoding,
  serialize: (payload) => payload ? Buffer.from(JSON.stringify(payload), encoding) : null,
  deserialize: (content) => {
    assert.buffer(content, 'content')
    return JSON.parse(content.toString(encoding))
  }
})

module.exports = jsonSerializerFactory
