const cutil = require('./configurator-util')

const magicEnvelopeFactory = require('../magic-envelope')
const jsonSerializerFactory = require('../json-serializer')
const ProducerPipeline = require('../middleware').ProducerPipeline
const publisherRoutePatternFactory = require('../route-patterns/publisher-route-pattern')

/**
 * Publisher Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
const publisherConfigurator = () => {
  let envelopeFactory = magicEnvelopeFactory
  let serializerFactory = jsonSerializerFactory
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
   * Overrides the default serializer implementation
   */
  const useSerializer = (serializer) => {
    cutil.assertObjectOrFunction(serializer, 'envelope')
    serializerFactory = cutil.createFactoryFunction(serializer)
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
    routePatternFactory = () => routePattern
  }

  /**
   * Overrides the default route pattern
   */
  const useRoutePatternFactory = (factoryFn) => {
    routePatternFactory = factoryFn
  }

  const getParams = () => ({
    envelope: envelopeFactory(),
    serializer: serializerFactory(),
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
      useEnvelope,
      useSerializer,
      usePipeline,
      useRouteName,
      useRoutePattern,
      useRoutePatternFactory
    }),
    getParams
  }
}

module.exports = publisherConfigurator
