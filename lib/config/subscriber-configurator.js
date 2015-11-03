'use strict';

var assert = require('assert-plus');

var Consumer = require('../consumer');
var Subscriber = require('../subscriber');
var BasicEnvelope = require('../basic-envelope');
var ConsumerPipeline = require('../middleware').ConsumerPipeline;
var WorkerRoutePattern = require('../route-patterns/worker-route-pattern');
var EventDispatcher = require('../event-dispatcher');

module.exports = SubscriberConfigurator;
/**
 * Consumer Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
function SubscriberConfigurator(broker, configurator){
  assert.object(broker, 'broker');
  assert.optionalFunc(configurator, 'configurator');

  this._broker = broker;
  this._configurator = configurator;

  var self = this;
  this._consumerFactory = function(){ return self._createConsumer(); };
  this._eventDispatcherFactory = function(){ return new EventDispatcher(); };

  this._envelopeFactory = function(){ return new BasicEnvelope(); };
  this._pipelineFactory = function() { return new ConsumerPipeline(); };
  this._routeNameFactory = function(){ return 'subscribe'; };
  this._routePatternFactory = function() { return new WorkerRoutePattern(); };
}

function _createFactoryFunction(item) {
  if (typeof(item) !== 'function') {
    return function() { return item; };
  }
  return item;
}

/**
 * Overrides the default consumer. If set, envelope, pipeline, routeName, and routePattern are ignored
 */
SubscriberConfigurator.prototype._createConsumer = function SubscriberConfigurator$_createConsumer(){
  return new Consumer(this._broker, this._envelopeFactory(), this._pipelineFactory(), this._routeNameFactory(), this._routePatternFactory());
};

/**
 * Overrides the default envelope implementation
 */
SubscriberConfigurator.prototype.useEnvelope = function SubscriberConfigurator$useEnvelope(envelope){
  this._envelopeFactory = _createFactoryFunction(envelope);
};

/**
 * Overrides the default middleware pipeline
 */
SubscriberConfigurator.prototype.usePipeline = function SubscriberConfigurator$usePipeline(pipeline){
  this._pipelineFactory = _createFactoryFunction(pipeline);
};

/**
 * Overrides the default route name
 */
SubscriberConfigurator.prototype.useRouteName = function SubscriberConfigurator$useRouteName(routeName){
  this._routeNameFactory = _createFactoryFunction(routeName);
};

/**
 * Overrides the default route pattern
 */
SubscriberConfigurator.prototype.useRoutePattern = function SubscriberConfigurator$useRoutePattern(routePattern){
  this._routePatternFactory = _createFactoryFunction(routePattern);
};

SubscriberConfigurator.prototype.createSubscriber = function SubscriberConfigurator$createSubscriber(){
  if (this._configurator){
    this._configurator(this);
  }
  return new Subscriber(this._consumerFactory(), this._eventDispatcherFactory());
};

/**
 * Message consumption callback
 * @callback consumerConfigFunction
 * @param {SubscriberConfigurator} config - configurator instance
 */
