'use strict';

var cutil = require('./configurator-util');

var BasicEnvelope = require('../basic-envelope');
var ProducerPipeline = require('../middleware').ProducerPipeline;
var PublisherRoutePattern = require('../route-patterns/publisher-route-pattern');

/**
 * Publisher Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
function PublisherConfigurator(baseConfig){
  this._envelopeFactory = function(){ return new BasicEnvelope(); };
  this._pipelineFactory = function() { return new ProducerPipeline(); };
  this._routeNameFactory = function(){ return 'publish'; };
  this._routePatternFactory = function() { return new PublisherRoutePattern(); };

  baseConfig.extend(this);
}

/**
 * Overrides the default envelope implementation
 */
PublisherConfigurator.prototype.useEnvelope = function PublisherConfigurator$useEnvelope(envelope){
  cutil.assertObjectOrFunction(envelope, 'envelope');
  this._envelopeFactory = cutil.createFactoryFunction(envelope);
};

/**
 * Overrides the default middleware pipeline
 */
PublisherConfigurator.prototype.usePipeline = function PublisherConfigurator$usePipeline(pipeline){
  cutil.assertObjectOrFunction(pipeline, 'pipeline');
  this._pipelineFactory = cutil.createFactoryFunction(pipeline);
};

/**
 * Overrides the default route name
 */
PublisherConfigurator.prototype.useRouteName = function PublisherConfigurator$useRouteName(routeName){
  cutil.assertStringOrFunction(routeName, 'routeName');
  this._routeNameFactory = cutil.createFactoryFunction(routeName);
};

/**
 * Overrides the default route pattern
 */
PublisherConfigurator.prototype.useRoutePattern = function PublisherConfigurator$useRoutePattern(routePattern){
  cutil.assertObjectOrFunction(routePattern, 'routePattern');
  this._routePatternFactory = cutil.createFactoryFunction(routePattern);
};

PublisherConfigurator.prototype.getParams = function PublisherConfigurator$getParams(){
  return {
    envelope: this._envelopeFactory(),
    pipeline: this._pipelineFactory(),
    routeName: this._routeNameFactory(),
    routePattern: this._routePatternFactory()
  };
};

/**
 * Message consumption callback
 * @callback publisherConfigFunction
 * @param {PublisherConfigurator} config - configurator instance
 */
module.exports = PublisherConfigurator;
