const PublisherTopology = require('../publisher/default-publisher-topology')
const PublishOptions = require('../publisher/publish-options')
const MagicEnvelope = require('../magic-envelope')
const JsonSerializer = require('../serialization/json-serializer')

const PublisherConfiguration = (broker) => {
  let routeNameFactory = () => 'publish'
  const defaultTopologyFactory =  () => PublisherTopology({
    routeName: routeNameFactory(),
    exchangeType: 'topic',
    durable: true,
    autoDelete: false,
    ...broker.getTopologyParams()
  })
  let topologyFactory = defaultTopologyFactory
  let envelopeFactory = () => MagicEnvelope({ contentType: 'application/prs.magicbus' })
  let serializerFactory = () => JsonSerializer({ encoding: 'utf-8', contentTypeSuffix: '+json' })

  let inputFilters = [() => topologyFactory()]
  let outputFilters = [() => PublishOptions, () => envelopeFactory().wrap, () => serializerFactory()]

  const useTopology = (topology) => {
    topologyFactory = () => topology
  }

  const useTopologyFactory = (factory) => {
    topologyFactory = factory
  }

  const useDefaultTopology = ({ exchangeType = 'topic', durable = true, autoDelete = false } = {}) => {
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

  const useJson = ({ encoding = 'utf-8', contentTypeSuffix = '+json' } = {}) => {
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
      inputFilters = [...input].map((f) => () => f)
    }
    if (output !== false) {
      outputFilters = [...output].map((f) => () => f)
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

module.exports = PublisherConfiguration
