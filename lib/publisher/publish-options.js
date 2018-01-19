const defaultPublishOptions = { persistent: true }
const PublishOptions = (ctx, next) => {
  ctx.publishOptions = Object.assign({}, defaultPublishOptions, ctx.publishOptions)
  return next(ctx)
}
PublishOptions.inspect = () => ({ type: 'Get Publishing Options', defaults: defaultPublishOptions })

module.exports = PublishOptions
