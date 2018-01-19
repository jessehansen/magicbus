const JsonSerializer = ({ encoding, contentTypeSuffix }) => {
  const serialize = (ctx, next) => {
    ctx.content = ctx.message ? Buffer.from(JSON.stringify(ctx.message), encoding) : null
    if (contentTypeSuffix && ctx.publishOptions && ctx.publishOptions.contentType) {
      ctx.publishOptions.contentType += contentTypeSuffix
    }
    return next(ctx)
  }
  serialize.inspect = () => ({
    type: 'JSON Serializer',
    encoding,
    contentTypeSuffix
  })

  return serialize
}

module.exports = JsonSerializer
