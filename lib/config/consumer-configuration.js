const cutil = require('./configurator-util')

const BasicEnvelope = require('../basic-envelope')
const ConsumerPipeline = require('../middleware').ConsumerPipeline
const workerRoutePatternFactory = require('../route-patterns/worker-route-pattern')

/**
 * Consumer Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
const consumerConfigurator = () => {
  let envelopeFactory = () => new BasicEnvelope()
  let pipelineFactory = () => ConsumerPipeline()
  let routeNameFactory = () => 'receive'
  let routePatternFactory = workerRoutePatternFactory

  /**
   * Overrides the default envelope implementation
   */
  const useEnvelope = (envelope) => {
    cutil.assertObjectOrFunction(envelope, 'envelope')
    envelopeFactory = cutil.createFactoryFunction(envelope)
  }

  /**
   * Overrides the default middleware pipeline
   */
  const usePipeline = (pipeline) => {
    cutil.assertObjectOrFunction(pipeline, 'pipeline')
    pipelineFactory = cutil.createFactoryFunction(pipeline)
  }

  /**
   * Overrides the default route name
   */
  const useRouteName = (routeName) => {
    cutil.assertStringOrFunction(routeName, 'routeName')
    routeNameFactory = cutil.createFactoryFunction(routeName)
  }

  /**
   * Overrides the default route pattern
   */
  const useRoutePattern = (routePattern) => {
    cutil.assertObjectOrFunction(routePattern, 'routePattern')
    routePatternFactory = cutil.createFactoryFunction(routePattern)
  }

  const getParams = () => ({
    envelope: envelopeFactory(),
    pipeline: pipelineFactory(),
    routeName: routeNameFactory(),
    routePattern: routePatternFactory()
  })

  return {
    /**
     * Gets the target for a configurator function to run on
     * @public
     * @param {Function} configFunc - the configuration function for the instance
     */
    getTarget: () => ({
      useEnvelope: useEnvelope,
      usePipeline: usePipeline,
      useRouteName: useRouteName,
      useRoutePattern: useRoutePattern
    }),
    getParams
  }
}

module.exports = consumerConfigurator
