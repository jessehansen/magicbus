'use strict';

var assert = require('assert-plus');
var Publisher = require('../Publisher');
var BasicEnvelope = require('../basic-envelope.js');
var ProducerPipeline = require('../middleware').ProducerPipeline;
var PublisherRoutePattern = require('../route-patterns/publisher-route-pattern');

module.exports = PublisherConfigurator;
/**
 * Publisher Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
function PublisherConfigurator(broker, configurator){
  assert.object(broker, 'broker');
  assert.optionalFunc(configurator, 'configurator');

  this._broker = broker;
  this._configurator = configurator;

  this._envelopeFactory = function(){ return new BasicEnvelope(); };
  this._pipelineFactory = function() { return new ProducerPipeline(); };
  this._routeNameFactory = function(){ return 'publish'; };
  this._routePatternFactory = function() { return new PublisherRoutePattern(); };
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
PublisherConfigurator.prototype.useEnvelope = function PublisherConfigurator$useEnvelope(envelope){
  this._envelopeFactory = _createFactoryFunction(envelope);
};

/**
 * Overrides the default middleware pipeline
 */
PublisherConfigurator.prototype.usePipeline = function PublisherConfigurator$usePipeline(pipeline){
  this._pipelineFactory = _createFactoryFunction(pipeline);
};

/**
 * Overrides the default route name
 */
PublisherConfigurator.prototype.useRouteName = function PublisherConfigurator$useRouteName(routeName){
  this._routeNameFactory = _createFactoryFunction(routeName);
};

/**
 * Overrides the default route pattern
 */
PublisherConfigurator.prototype.useRoutePattern = function PublisherConfigurator$useRoutePattern(routePattern){
  this._routePatternFactory = _createFactoryFunction(routePattern);
};

PublisherConfigurator.prototype.createPublisher = function PublisherConfigurator$createPublisher(){
  if (this._configurator){
    this._configurator(this);
  }
  return new Publisher(this._broker, this._envelopeFactory(), this._pipelineFactory(), this._routeNameFactory(), this._routePatternFactory());
};

/**
 * Message consumption callback
 * @callback publisherConfigFunction
 * @param {PublisherConfigurator} config - configurator instance
 */
