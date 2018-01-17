const PublisherTopology = require('../publisher/default-publisher-topology')
const MagicEnvelope = require('../magic-envelope')
const JsonSerializer = require('../serialization/json-serializer')

const PublisherConfigurator = (broker) => {
  let routeNameFactory = () => 'publish'
  const defaultTopologyFactory =  (params = {}) => () => PublisherTopology({
    routeName: routeNameFactory(),
    ...broker.getTopologyParams(),
    ...params
  })
  let topologyFactory = defaultTopologyFactory()
  let envelopeFactory = MagicEnvelope
  let serializerFactory = JsonSerializer

  let inputFilters = [() => topologyFactory()]
  let outputFilters = [() => envelopeFactory().wrap, () => serializerFactory()]

  const useTopology = (topology) => {
    topologyFactory = () => topology
  }

  const useTopologyFactory = (factory) => {
    topologyFactory = factory
  }

  const useDefaultTopology = ({ exchangeType = 'topic', durable = true, autoDelete = false }) => {
    topologyFactory = () => PublisherTopology({
      routeName: routeNameFactory(),
      exchangeType,
      durable,
      autoDelete,
      ...broker.getTopologyParams()
    })
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

  const useJson = ({ encoding = 'utf-8', contentTypeSuffix = '+json' }) => {
    serializerFactory = () => JsonSerializer({ encoding, contentTypeSuffix })
  }

  const useSerializer = (serializer) => {
    serializerFactory = () => serializer
  }

  const useSerializerFactory = (factory) => {
    serializerFactory = factory
  }

  const useRouteName = (routeName) => {
    routeNameFactory = typeof routeName === 'function' ? routeName : () => routeName
  }

  const useFilter = (filter) => {
    inputFilters.push(() => filter)
  }

  const useFilterFactory = (factory) => {
    inputFilters.push(factory)
  }

  const overrideFilters = ({ input = false, output = false }) => {
    if (input !== false) {
      inputFilters = Array.from(input).map((f) => () => f)
    }
    if (output !== false) {
      outputFilters = Array.from(output).map((f) => () => f)
    }
  }

  const getParams = () => ({
    inputFilters: inputFilters.map((f) => f()),
    outputFilters: outputFilters.map((f) => f())
  })

  return {
    getConfigurator: () => ({
      useTopology,
      useTopologyFactory,
      useDefaultTopology,
      useEnvelope,
      useEnvelopeFactory,
      useMagicEnvelope,
      useJson,
      useSerializer,
      useSerializerFactory,
      useRouteName,
      useFilter,
      useFilterFactory,
      overrideFilters
    }),
    getParams
  }
}

module.exports = PublisherConfigurator
