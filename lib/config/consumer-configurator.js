'use strict';

var cutil = require('./configurator-util');

var BasicEnvelope = require('../basic-envelope');
var ConsumerPipeline = require('../middleware').ConsumerPipeline;
var WorkerRoutePattern = require('../route-patterns/worker-route-pattern');

module.exports = ConsumerConfigurator;
/**
 * Consumer Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
function ConsumerConfigurator(baseConfig){
  this._envelopeFactory = function(){ return new BasicEnvelope(); };
  this._pipelineFactory = function() { return new ConsumerPipeline(); };
  this._routeNameFactory = function(){ return 'receive'; };
  this._routePatternFactory = function() { return new WorkerRoutePattern(); };

  baseConfig.extend(this);
}

/**
 * Overrides the default envelope implementation
 */
ConsumerConfigurator.prototype.useEnvelope = function ConsumerConfigurator$useEnvelope(envelope){
  cutil.assertObjectOrFunction(envelope, 'envelope');
  this._envelopeFactory = cutil.createFactoryFunction(envelope);
};

/**
 * Overrides the default middleware pipeline
 */
ConsumerConfigurator.prototype.usePipeline = function ConsumerConfigurator$usePipeline(pipeline){
  cutil.assertObjectOrFunction(pipeline, 'pipeline');
  this._pipelineFactory = cutil.createFactoryFunction(pipeline);
};

/**
 * Overrides the default route name
 */
ConsumerConfigurator.prototype.useRouteName = function ConsumerConfigurator$useRouteName(routeName){
  cutil.assertStringOrFunction(routeName, 'routeName');
  this._routeNameFactory = cutil.createFactoryFunction(routeName);
};

/**
 * Overrides the default route pattern
 */
ConsumerConfigurator.prototype.useRoutePattern = function ConsumerConfigurator$useRoutePattern(routePattern){
  cutil.assertObjectOrFunction(routePattern, 'routePattern');
  this._routePatternFactory = cutil.createFactoryFunction(routePattern);
};

ConsumerConfigurator.prototype.getParams = function ConsumerConfigurator$getParams(){
  return {
    envelope: this._envelopeFactory(),
    pipeline: this._pipelineFactory(),
    routeName: this._routeNameFactory(),
    routePattern: this._routePatternFactory()
  };
};

/**
 * Message consumption callback
 * @callback consumerConfigFunction
 * @param {ConsumerConfigurator} config - configurator instance
 */
