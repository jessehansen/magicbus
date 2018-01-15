const jsonSerializerFactory = (encoding = 'utf8', contentTypeSuffix = '+json') => ({
  contentTypeSuffix,
  encoding,
  serialize: (ctx, next) => {
    ctx.content = ctx.message ? Buffer.from(JSON.stringify(ctx.message), encoding) : null
    if (contentTypeSuffix) {
      ctx.publishOptions.contentType += contentTypeSuffix
    }
    return next(ctx)
  },
  deserialize: (ctx, next) => {
    ctx.message = JSON.parse(ctx.content.toString(encoding))
    return next(ctx)
  }
})

module.exports = jsonSerializerFactory
