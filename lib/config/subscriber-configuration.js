const cutil = require('./configurator-util')
const magicEnvelopeFactory = require('../magic-envelope')
const jsonSerializerFactory = require('../json-serializer')
const ConsumerPipeline = require('../middleware').ConsumerPipeline
const workerRoutePatternFactory = require('../route-patterns/worker-route-pattern')
const EventDispatcher = require('../event-dispatcher')

/**
 * Subscriber Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
const subscriberConfigurator = () => {
  let consumerFactory = () => null
  let eventDispatcherFactory = () => EventDispatcher()
  let envelopeFactory = magicEnvelopeFactory
  let serializerFactory = jsonSerializerFactory
  let pipelineFactory = () => ConsumerPipeline()
  let routeNameFactory = () => 'subscribe'
  let routePatternFactory = workerRoutePatternFactory

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

  /**
   * Overrides the default consumer. If used, envelope, pipeline, routeName, and routePattern are ignored.
   */
  const useConsumer = (consumer) => {
    cutil.assertObjectOrFunction(consumer, 'consumer')
    consumerFactory = cutil.createFactoryFunction(consumer)
  }

  /**
   * Overrides the default event dispatcher
   */
  const useEventDispatcher = (eventDispatcher) => {
    cutil.assertObjectOrFunction(eventDispatcher, 'eventDispatcher')
    eventDispatcherFactory = cutil.createFactoryFunction(eventDispatcher)
  }

  const getParams = () => ({
    consumer: consumerFactory(),
    eventDispatcher: eventDispatcherFactory(),

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
      useConsumer,
      useEventDispatcher,
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

module.exports = subscriberConfigurator
