const ExistingQueueTopology = ({ topology, queue }) => async (ctx, next) => {
  await topology.connectQueue(queue)
  ctx.queue = queue
  await next(ctx)
}

module.exports = ExistingQueueTopology
