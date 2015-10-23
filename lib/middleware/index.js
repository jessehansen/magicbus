'use strict';

var Pipeline = require('./pipeline');
var ProducerActions = require('./producer-actions');
var ConsumerActions = require('./consumer-actions');

module.exports = {
  ProducerPipeline: Pipeline.withActionFactory(function(){ return new ProducerActions(); }),
  ConsumerPipeline: Pipeline.withActionFactory(function(){ return new ConsumerActions(); })
};
