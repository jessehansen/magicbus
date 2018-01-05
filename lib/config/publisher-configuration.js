
let cutil = require('./configurator-util')

let BasicEnvelope = require('../basic-envelope')
let ProducerPipeline = require('../middleware').ProducerPipeline
let publisherRoutePatternFactory = require('../route-patterns/publisher-route-pattern')

/**
 * Publisher Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
const publisherConfigurator = () => {
  let envelopeFactory = () => new BasicEnvelope()
  let pipelineFactory = () => ProducerPipeline()
  let routeNameFactory = () => 'publish'
  let routePatternFactory = publisherRoutePatternFactory

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
  const useRoutePattern = (newPatternFactory) => {
    routePatternFactory = newPatternFactory
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

module.exports = publisherConfigurator
