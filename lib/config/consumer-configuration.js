const DefaultConsumerTopology = require('../consumer/default-consumer-topology')
const ExistingQueueTopology = require('../consumer/existing-queue-topology')
const ListenerConsumerTopology = require('../consumer/listener-consumer-topology')
const MagicEnvelope = require('../magic-envelope')
const JsonDeserializer = require('../serialization/json-deserializer')

const ConsumerConfiguration = (defaultRouteName) => (broker) => {
  let routeNameFactory = () => defaultRouteName
  let topologyFactory = () => DefaultConsumerTopology({
    routeName: routeNameFactory(),
    noAck: false,
    durable: true,
    autoDelete: false,
    exclusive: false,
    failureQueue: true,
    ...broker.getTopologyParams()
  })
  let envelopeFactory = () => MagicEnvelope({ contentType: 'application/prs.magicbus' })
  let deserializerFactory = () => JsonDeserializer({ encoding: 'utf-8' })

  let consumeFilters = [() => topologyFactory()]
  let messageInputFilters = [() => deserializerFactory(), () => envelopeFactory().unwrap]
  let messageOutputFilters = []

  const useTopology = (topology) => {
    topologyFactory = () => topology
  }

  const useTopologyFactory = (factory) => {
    topologyFactory = factory
  }

  const useDefaultTopology = ({
    noAck = false,
    durable = true,
    autoDelete = false,
    exclusive = false,
    failureQueue = true
  } = {}) => {
    topologyFactory = () => DefaultConsumerTopology({
      routeName: routeNameFactory(),
      noAck,
      durable,
      autoDelete,
      exclusive,
      failureQueue,
      ...broker.getTopologyParams()
    })
  }

  const useListenerTopology = ({
    noAck = false,
    durable = true,
    autoDelete = false,
    exclusive = false,
    failureQueue = true
  } = {}) => {
    topologyFactory = () => ListenerConsumerTopology({
      routeName: routeNameFactory(),
      noAck,
      durable,
      autoDelete,
      exclusive,
      failureQueue,
      ...broker.getTopologyParams()
    })
  }

  const useExistingQueue = (queue) => {
    topologyFactory = () => ExistingQueueTopology({ queue, ...broker.getTopologyParams() })
  }

  const useEnvelope = (envelope) => {
    envelopeFactory = () => envelope
  }

  const useEnvelopeFactory = (factory) => {
    envelopeFactory = factory
  }

  const useMagicEnvelope = ({ contentType } = {}) => {
    envelopeFactory = () => MagicEnvelope({ contentType })
  }

  const useDeserializer = (deserializer) => {
    deserializerFactory = () => deserializer
  }

  const useDeserializerFactory = (factory) => {
    deserializerFactory = factory
  }

  const useJson = ({ encoding = 'utf-8' } = {}) => {
    deserializerFactory = () => JsonDeserializer({ encoding })
  }

  const useRouteName = (routeName) => {
    routeNameFactory = typeof routeName === 'function' ? routeName : () => routeName
  }

  const useFilter = (filter) => {
    messageInputFilters.push(() => filter)
  }

  const useFilterFactory = (factory) => {
    messageInputFilters.push(factory)
  }

  const overrideFilters = ({ consume = false, input = false, output = false }) => {
    if (consume !== false) {
      // todo: yuck
      consumeFilters = Array.from(consume).map((f) => () => f)
    }
    if (input !== false) {
      messageInputFilters = Array.from(input).map((f) => () => f)
    }
    if (output !== false) {
      messageOutputFilters = Array.from(output).map((f) => () => f)
    }
  }

  const getParams = () => ({
    consumeFilters: consumeFilters.map((f) => f()),
    messageInputFilters: messageInputFilters.map((f) => f()),
    messageOutputFilters: messageOutputFilters.map((f) => f())
  })

  return {
    getConfigurator: () => ({
      useTopology,
      useTopologyFactory,
      useDefaultTopology,
      useListenerTopology,
      useExistingQueue,
      useEnvelope,
      useEnvelopeFactory,
      useMagicEnvelope,
      useDeserializer,
      useDeserializerFactory,
      useJson,
      useRouteName,
      useFilter,
      useFilterFactory,
      overrideFilters
    }),
    getParams
  }
}

module.exports = ConsumerConfiguration('receive')
module.exports.withDefaultRouteName = ConsumerConfiguration
