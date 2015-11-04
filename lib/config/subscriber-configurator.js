'use strict';

var cutil = require('./configurator-util');

var BasicEnvelope = require('../basic-envelope');
var ConsumerPipeline = require('../middleware').ConsumerPipeline;
var WorkerRoutePattern = require('../route-patterns/worker-route-pattern');
var EventDispatcher = require('../event-dispatcher');

module.exports = SubscriberConfigurator;
/**
 * Subscriber Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
function SubscriberConfigurator(baseConfig){
  this._consumerFactory = function(){ return null; };
  this._eventDispatcherFactory = function(){ return new EventDispatcher(); };

  this._envelopeFactory = function(){ return new BasicEnvelope(); };
  this._pipelineFactory = function() { return new ConsumerPipeline(); };
  this._routeNameFactory = function(){ return 'subscribe'; };
  this._routePatternFactory = function() { return new WorkerRoutePattern(); };

  baseConfig.extend(this);
}

/**
 * Overrides the default envelope implementation
 */
SubscriberConfigurator.prototype.useEnvelope = function SubscriberConfigurator$useEnvelope(envelope){
  cutil.assertObjectOrFunction(envelope, 'envelope');
  this._envelopeFactory = cutil.createFactoryFunction(envelope);
};

/**
 * Overrides the default middleware pipeline
 */
SubscriberConfigurator.prototype.usePipeline = function SubscriberConfigurator$usePipeline(pipeline){
  cutil.assertObjectOrFunction(pipeline, 'pipeline');
  this._pipelineFactory = cutil.createFactoryFunction(pipeline);
};

/**
 * Overrides the default route name
 */
SubscriberConfigurator.prototype.useRouteName = function SubscriberConfigurator$useRouteName(routeName){
  cutil.assertStringOrFunction(routeName, 'routeName');
  this._routeNameFactory = cutil.createFactoryFunction(routeName);
};

/**
 * Overrides the default route pattern
 */
SubscriberConfigurator.prototype.useRoutePattern = function SubscriberConfigurator$useRoutePattern(routePattern){
  cutil.assertObjectOrFunction(routePattern, 'routePattern');
  this._routePatternFactory = cutil.createFactoryFunction(routePattern);
};

/**
 * Overrides the default consumer. If used, envelope, pipeline, routeName, and routePattern are ignored.
 */
SubscriberConfigurator.prototype.useConsumer = function SubscriberConfigurator$useConsumer(consumer){
  cutil.assertObjectOrFunction(consumer, 'consumer');
  this._consumerFactory = cutil.createFactoryFunction(consumer);
};

/**
 * Overrides the default event dispatcher
 */
SubscriberConfigurator.prototype.useEventDispatcher = function SubscriberConfigurator$useEventDispatcher(eventDispatcher){
  cutil.assertObjectOrFunction(eventDispatcher, 'eventDispatcher');
  this._eventDispatcherFactory = cutil.createFactoryFunction(eventDispatcher);
};

SubscriberConfigurator.prototype.getParams = function SubscriberConfigurator$getParams(){
  return {
    consumer: this._consumerFactory(),
    eventDispatcher: this._eventDispatcherFactory(),

    envelope: this._envelopeFactory(),
    pipeline: this._pipelineFactory(),
    routeName: this._routeNameFactory(),
    routePattern: this._routePatternFactory()
  };
};

/**
 * Message consumption callback
 * @callback consumerConfigFunction
 * @param {SubscriberConfigurator} config - configurator instance
 */
