const magicEnvelopeFactory = ({
  contentType = "application/prs.magicbus",
} = {}) => ({
  wrap: (data, kind, serializer) => ({
    properties: {
      contentType: contentType + serializer.contentTypeSuffix,
      type: kind,
    },
    payload: data,
  }),
  getPublishOptions: (data, kind) => ({ routingKey: kind }),

  unwrap: ({ payload = null }) => payload,
  getMessageTypes: ({ properties = {} } = {}) =>
    properties.type ? [properties.type] : [],
});

module.exports = magicEnvelopeFactory;
