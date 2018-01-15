const defaultPublishOptions = { persistent: true }
const getPublishOptions = (ctx, next) => {
  Object.assign(ctx.publishOptions, defaultPublishOptions, ctx.options.publishOptions)
  return next(ctx)
}

module.exports = getPublishOptions
