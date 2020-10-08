const magicEnvelopeFactory = require("../magic-envelope");
const jsonSerializerFactory = require("../json-serializer");
const ProducerPipeline = require("../middleware").ProducerPipeline;
const publisherRoutePatternFactory = require("../route-patterns/publisher-route-pattern");

const publisherConfigurator = () => {
  let envelopeFactory = magicEnvelopeFactory;
  let serializerFactory = jsonSerializerFactory;
  let pipelineFactory = () => ProducerPipeline();
  let routeNameFactory = () => "publish";
  let routePatternFactory = publisherRoutePatternFactory;

  const useEnvelope = (envelope) => {
    envelopeFactory = () => envelope;
  };

  const useEnvelopeFactory = (factory) => {
    envelopeFactory = factory;
  };

  const useSerializer = (serializer) => {
    serializerFactory = () => serializer;
  };

  const useSerializerFactory = (factory) => {
    serializerFactory = factory;
  };

  const usePipeline = (pipeline) => {
    pipelineFactory = () => pipeline;
  };

  const usePipelineFactory = (factory) => {
    pipelineFactory = factory;
  };

  const useRouteName = (routeName) => {
    routeNameFactory =
      typeof routeName === "function" ? routeName : () => routeName;
  };

  const useRoutePattern = (routePattern) => {
    routePatternFactory = () => routePattern;
  };

  const useRoutePatternFactory = (factory) => {
    routePatternFactory = factory;
  };

  const getParams = () => ({
    envelope: envelopeFactory(),
    serializer: serializerFactory(),
    pipeline: pipelineFactory(),
    routeName: routeNameFactory(),
    routePattern: routePatternFactory(),
  });

  return {
    getConfigurator: () => ({
      useEnvelope,
      useEnvelopeFactory,
      useSerializer,
      useSerializerFactory,
      usePipeline,
      usePipelineFactory,
      useRouteName,
      useRoutePattern,
      useRoutePatternFactory,
    }),
    getParams,
  };
};

module.exports = publisherConfigurator;
