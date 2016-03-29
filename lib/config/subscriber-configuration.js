'use strict';

var cutil = require('./configurator-util');

var BasicEnvelope = require('../basic-envelope');
var ConsumerPipeline = require('../middleware').ConsumerPipeline;
var WorkerRoutePattern = require('../route-patterns/worker-route-pattern');
var EventDispatcher = require('../event-dispatcher');

/**
 * Subscriber Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
module.exports = function SubscriberConfiguration(){
  let consumerFactory = function(){ return null; };
  let eventDispatcherFactory = function(){ return EventDispatcher(); };

  let envelopeFactory = function(){ return new BasicEnvelope(); };
  let pipelineFactory = function() { return new ConsumerPipeline(); };
  let routeNameFactory = function(){ return 'subscribe'; };
  let routePatternFactory = function() { return new WorkerRoutePattern(); };

  /**
   * Overrides the default envelope implementation
   */
  function useEnvelope(envelope){
    cutil.assertObjectOrFunction(envelope, 'envelope');
    envelopeFactory = cutil.createFactoryFunction(envelope);
  };

  /**
   * Overrides the default middleware pipeline
   */
  function usePipeline(pipeline){
    cutil.assertObjectOrFunction(pipeline, 'pipeline');
    pipelineFactory = cutil.createFactoryFunction(pipeline);
  };

  /**
   * Overrides the default route name
   */
  function useRouteName(routeName){
    cutil.assertStringOrFunction(routeName, 'routeName');
    routeNameFactory = cutil.createFactoryFunction(routeName);
  };

  /**
   * Overrides the default route pattern
   */
  function useRoutePattern(routePattern){
    cutil.assertObjectOrFunction(routePattern, 'routePattern');
    routePatternFactory = cutil.createFactoryFunction(routePattern);
  };

  /**
   * Overrides the default consumer. If used, envelope, pipeline, routeName, and routePattern are ignored.
   */
  function useConsumer(consumer){
    cutil.assertObjectOrFunction(consumer, 'consumer');
    consumerFactory = cutil.createFactoryFunction(consumer);
  };

  /**
   * Overrides the default event dispatcher
   */
  function useEventDispatcher(eventDispatcher){
    cutil.assertObjectOrFunction(eventDispatcher, 'eventDispatcher');
    eventDispatcherFactory = cutil.createFactoryFunction(eventDispatcher);
  };

  function getParams(){
    return {
      consumer: consumerFactory(),
      eventDispatcher: eventDispatcherFactory(),

      envelope: envelopeFactory(),
      pipeline: pipelineFactory(),
      routeName: routeNameFactory(),
      routePattern: routePatternFactory()
    };
  };

  return {
    /**
     * Gets the target for a configurator function to run on
     * @public
     * @param {Function} configFunc - the configuration function for the instance
     */
    getTarget: function() {
      return {
        useConsumer: useConsumer,
        useEventDispatcher: useEventDispatcher,
        useEnvelope: useEnvelope,
        usePipeline: usePipeline,
        useRouteName: useRouteName,
        useRoutePattern: useRoutePattern
      };
    },
    getParams: getParams
  };
};
