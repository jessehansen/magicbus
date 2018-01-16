const JsonDeserializer = ({ encoding = 'utf8' } = {}) => {
  const deserialize = (ctx, next) => {
    ctx.message = JSON.parse(ctx.content.toString(encoding))
    return next(ctx)
  }
  deserialize.inspect = () => ({
    type: 'JSON Deserializer',
    encoding
  })
  return deserialize
}

module.exports = JsonDeserializer
