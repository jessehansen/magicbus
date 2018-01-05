const cutil = require('./configurator-util')
let BasicEnvelope = require('../basic-envelope')
let ConsumerPipeline = require('../middleware').ConsumerPipeline
let workerRoutePatternFactory = require('../route-patterns/worker-route-pattern')
let EventDispatcher = require('../event-dispatcher')

/**
 * Subscriber Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
const subscriberConfigurator = () => {
  let consumerFactory = () => null
  let eventDispatcherFactory = () => EventDispatcher()
  let envelopeFactory = () => new BasicEnvelope()
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
      useConsumer: useConsumer,
      useEventDispatcher: useEventDispatcher,
      useEnvelope: useEnvelope,
      usePipeline: usePipeline,
      useRouteName: useRouteName,
      useRoutePattern: useRoutePattern
    }),
    getParams
  }
}

module.exports = subscriberConfigurator
