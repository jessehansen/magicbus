'use strict';

var cutil = require('./configurator-util');

var BasicEnvelope = require('../basic-envelope');
var ConsumerPipeline = require('../middleware').ConsumerPipeline;
var WorkerRoutePattern = require('../route-patterns/worker-route-pattern');

/**
 * Consumer Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
module.exports = function ConsumerConfiguration(){
  let envelopeFactory = function(){ return new BasicEnvelope(); };
  let pipelineFactory = function() { return new ConsumerPipeline(); };
  let routeNameFactory = function(){ return 'receive'; };
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

  function getParams(){
    return {
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
        useEnvelope: useEnvelope,
        usePipeline: usePipeline,
        useRouteName: useRouteName,
        useRoutePattern: useRoutePattern
      };
    },
    getParams: getParams
  };
};
