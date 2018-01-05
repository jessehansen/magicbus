const pipelineFactory = require('./pipeline')
const ProducerActions = require('./producer-actions')
const ConsumerActions = require('./consumer-actions')

module.exports = {
  ProducerPipeline: pipelineFactory(() => new ProducerActions()),
  ConsumerPipeline: pipelineFactory(() => new ConsumerActions())
}
