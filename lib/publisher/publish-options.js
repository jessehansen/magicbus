const defaultPublishOptions = { persistent: true }
const getPublishOptions = (ctx, next) => {
  Object.assign(ctx.publishOptions, defaultPublishOptions, ctx.options.publishOptions)
  return next(ctx)
}
getPublishOptions.inspect = () => ({ type: 'Get Publishing Options', defaults: defaultPublishOptions })

module.exports = getPublishOptions
