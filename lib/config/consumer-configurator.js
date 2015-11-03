'use strict';

var assert = require('assert-plus');

var Consumer = require('../consumer.js');
var BasicEnvelope = require('../basic-envelope.js');
var ConsumerPipeline = require('../middleware').ConsumerPipeline;
var WorkerRoutePattern = require('../route-patterns/worker-route-pattern.js');

module.exports = ConsumerConfigurator;
/**
 * Consumer Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
function ConsumerConfigurator(broker, configurator){
  assert.object(broker, 'broker');
  assert.optionalFunc(configurator, 'configurator');

  this._broker = broker;
  this._configurator = configurator;

  this._envelopeFactory = function(){ return new BasicEnvelope(); };
  this._pipelineFactory = function() { return new ConsumerPipeline(); };
  this._routeNameFactory = function(){ return 'receive'; };
  this._routePatternFactory = function() { return new WorkerRoutePattern(); };
}

function _createFactoryFunction(item) {
  if (typeof(item) !== 'function') {
    return function() { return item; };
  }
  return item;
}

/**
 * Overrides the default envelope implementation
 */
ConsumerConfigurator.prototype.useEnvelope = function ConsumerConfigurator$useEnvelope(envelope){
  this._envelopeFactory = _createFactoryFunction(envelope);
};

/**
 * Overrides the default middleware pipeline
 */
ConsumerConfigurator.prototype.usePipeline = function ConsumerConfigurator$usePipeline(pipeline){
  this._pipelineFactory = _createFactoryFunction(pipeline);
};

/**
 * Overrides the default route name
 */
ConsumerConfigurator.prototype.useRouteName = function ConsumerConfigurator$useRouteName(routeName){
  this._routeNameFactory = _createFactoryFunction(routeName);
};

/**
 * Overrides the default route pattern
 */
ConsumerConfigurator.prototype.useRoutePattern = function ConsumerConfigurator$useRoutePattern(routePattern){
  this._routePatternFactory = _createFactoryFunction(routePattern);
};

ConsumerConfigurator.prototype.createConsumer = function ConsumerConfigurator$createConsumer(){
  if (this._configurator){
    this._configurator(this);
  }
  return new Consumer(this._broker, this._envelopeFactory(), this._pipelineFactory(), this._routeNameFactory(), this._routePatternFactory());
};

/**
 * Message consumption callback
 * @callback consumerConfigFunction
 * @param {ConsumerConfigurator} config - configurator instance
 */
