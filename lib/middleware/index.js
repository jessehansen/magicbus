
let Pipeline = require('./pipeline')
let ProducerActions = require('./producer-actions')
let ConsumerActions = require('./consumer-actions')

module.exports = {
  ProducerPipeline: Pipeline.withActionFactory(function () {
    return new ProducerActions()
  }),
  ConsumerPipeline: Pipeline.withActionFactory(function () {
    return new ConsumerActions()
  })
}
