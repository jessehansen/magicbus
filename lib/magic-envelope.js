const magicEnvelopeFactory = ({ contentType = 'application/prs.magicbus' } = {}) => ({
  wrap: (ctx, next) => {
    ctx.publishOptions = Object.assign(ctx.publishOptions || {},
      {
        contentType: contentType,
        type: ctx.kind,
        routingKey: ctx.kind
      })
    return next(ctx)
  },
  unwrap: (ctx, next) => {
    const { payload = null, properties = {} } = ctx
    ctx.message = { payload }
    ctx.messageTypes = properties.type ? [properties.type] : []
    return next(ctx)
  }
})

module.exports = magicEnvelopeFactory
