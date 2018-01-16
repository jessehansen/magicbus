const JsonSerializer = ({ encoding = 'utf8', contentTypeSuffix = '+json' } = {}) => {
  const serialize = (ctx, next) => {
    ctx.content = ctx.message ? Buffer.from(JSON.stringify(ctx.message), encoding) : null
    if (contentTypeSuffix) {
      ctx.publishOptions.contentType += contentTypeSuffix
    }
    return next(ctx)
  }
  serialize.inspect = () => ({
    type: 'JSON Deserializer',
    encoding,
    contentTypeSuffix
  })

  return serialize
}

module.exports = JsonSerializer
