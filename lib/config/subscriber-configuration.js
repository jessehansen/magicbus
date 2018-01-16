const magicEnvelopeFactory = require('../magic-envelope')
const jsonSerializerFactory = require('../serialization/json-serializer')
const workerRoutePatternFactory = require('../route-patterns/worker-route-pattern')
const EventDispatcher = require('../event-dispatcher')

const subscriberConfigurator = () => {
  let consumerFactory = () => null
  let eventDispatcherFactory = () => EventDispatcher()
  let envelopeFactory = magicEnvelopeFactory
  let serializerFactory = jsonSerializerFactory
  let pipelineFactory = () =>  ({})
  let routeNameFactory = () => 'subscribe'
  let routePatternFactory = workerRoutePatternFactory

  const useEnvelope = (envelope) => {
    envelopeFactory = () => envelope
  }

  const useEnvelopeFactory = (factory) => {
    envelopeFactory = factory
  }

  const useSerializer = (serializer) => {
    serializerFactory = () => serializer
  }

  const useSerializerFactory = (factory) => {
    serializerFactory = factory
  }

  const usePipeline = (pipeline) => {
    pipelineFactory = () => pipeline
  }

  const usePipelineFactory = (factory) => {
    pipelineFactory = factory
  }

  const useRouteName = (routeName) => {
    routeNameFactory = typeof routeName === 'function' ? routeName : () => routeName
  }

  const useRoutePattern = (routePattern) => {
    routePatternFactory = () => routePattern
  }

  const useRoutePatternFactory = (factory) => {
    routePatternFactory = factory
  }

  const useConsumer = (consumer) => {
    consumerFactory = () => consumer
  }

  const useConsumerFactory = (factory) => {
    consumerFactory = factory
  }

  const useEventDispatcher = (eventDispatcher) => {
    eventDispatcherFactory = () => eventDispatcher
  }

  const useEventDispatcherFactory = (factory) => {
    eventDispatcherFactory = factory
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
    getConfigurator: () => ({
      useConsumer,
      useConsumerFactory,
      useEventDispatcher,
      useEventDispatcherFactory,
      useEnvelope,
      useEnvelopeFactory,
      useSerializer,
      useSerializerFactory,
      usePipeline,
      usePipelineFactory,
      useRouteName,
      useRoutePattern,
      useRoutePatternFactory
    }),
    getParams
  }
}

module.exports = subscriberConfigurator
