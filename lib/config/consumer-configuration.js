const ConsumerTopology = require('../consumer/topology')
const MagicEnvelope = require('../magic-envelope')
const JsonDeserializer = require('../serialization/json-deserializer')

const consumerConfigurator = (broker) => {
  let routeNameFactory = () => 'receive'
  const defaultTopologyFactory =  (params = {}) => () => ConsumerTopology({
    routeName: routeNameFactory(),
    ...broker.getTopologyParams(),
    ...params
  })
  let topologyFactory = defaultTopologyFactory()
  let envelopeFactory = MagicEnvelope
  let deserializerFactory = JsonDeserializer

  let consumeFilters = [() => topologyFactory()]
  let messageInputFilters = [() => deserializerFactory(), () => envelopeFactory().unwrap]
  let messageOutputFilters = []

  const useTopology = (topology) => {
    topologyFactory = () => topology
  }

  const useTopologyFactory = (factory) => {
    topologyFactory = factory
  }

  const useDefaultTopology = ({ noAck = false, durable = true, autoDelete = false, exclusive = false }) => {
    topologyFactory = () => ConsumerTopology({
      routeName: routeNameFactory(),
      noAck,
      durable,
      autoDelete,
      exclusive,
      ...broker.getTopologyParams()
    })
  }

  const useEnvelope = (envelope) => {
    envelopeFactory = () => envelope
  }

  const useEnvelopeFactory = (factory) => {
    envelopeFactory = factory
  }

  const useDeserializer = (deserializer) => {
    deserializerFactory = () => deserializer
  }

  const useDeserializerFactory = (factory) => {
    deserializerFactory = factory
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
      consumeFilters = Array.from(consume)
    }
    if (input !== false) {
      messageInputFilters = Array.from(input)
    }
    if (output !== false) {
      messageOutputFilters = Array.from(output)
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
      useEnvelope,
      useEnvelopeFactory,
      useDeserializer,
      useDeserializerFactory,
      useRouteName,
      useFilter,
      useFilterFactory,
      overrideFilters
    }),
    getParams
  }
}

module.exports = consumerConfigurator
