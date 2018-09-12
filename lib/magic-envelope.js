const MagicEnvelope = ({ contentType }) => {
  const envelope = {
    wrap: (ctx, next) => {
      ctx.publishOptions = Object.assign(ctx.publishOptions || {},
        {
          contentType: contentType,
          type: ctx.kind
        })
      ctx.routingKey = ctx.kind
      return next(ctx)
    },
    unwrap: (ctx, next) => {
      const { properties = {} } = ctx
      ctx.messageTypes = properties.type ? [properties.type] : []
      return next(ctx)
    }
  }

  envelope.wrap.inspect = () => ({
    type: 'Magic Envelope Wrap',
    contentType
  })

  envelope.unwrap.inspect = () => ({
    type: 'Magic Envelope Unwrap'
  })

  return envelope
}

module.exports = MagicEnvelope
