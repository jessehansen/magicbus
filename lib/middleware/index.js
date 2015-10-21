'use strict';

var Pipeline = require('./pipeline');
var ProducerActions = require('./producer-actions');
var ConsumerActions = require('./consumer-actions');

module.exports = {
  ProducerPipeline: Pipeline.withActions(new ProducerActions()),
  ConsumerPipeline: Pipeline.withActions(new ConsumerActions())
};
