const EventDispatcher = require('../event-dispatcher')

const SubscriberConfigurator = () => {
  let consumerFactory = () => null
  let eventDispatcherFactory = () => EventDispatcher()

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
    eventDispatcher: eventDispatcherFactory()
  })

  return {
    getConfigurator: () => ({
      useConsumer,
      useConsumerFactory,
      useEventDispatcher,
      useEventDispatcherFactory
    }),
    getParams
  }
}

module.exports = SubscriberConfigurator
