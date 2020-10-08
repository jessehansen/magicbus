const magicEnvelope = require("../lib/magic-envelope");

describe("MagicEnvelope", () => {
  let envelope;
  let fakeSerializer = { contentTypeSuffix: "+json" };

  beforeEach(() => {
    envelope = magicEnvelope();
  });

  describe("wrap", () => {
    it("should set the content type", () => {
      let msg = envelope.wrap({ my: "data" }, "my-kind", fakeSerializer);

      expect(msg.properties.contentType).toEqual(
        "application/prs.magicbus+json"
      );
    });

    it("should put the kind of the message in the type property of the amqp properties", () => {
      let msg = envelope.wrap({ my: "data" }, "my-kind", fakeSerializer);

      expect(msg.properties.type).toEqual("my-kind");
    });

    it("should put the data of the message in the payload", () => {
      let msg = envelope.wrap({ my: "data" }, "my-kind", fakeSerializer);

      let expected = {
        my: "data",
      };
      expect(msg.payload).toEqual(expected);
    });
  });

  describe("getPublishOptions", () => {
    it("should return the kind of the message as the routing key", () => {
      let publishOptions = envelope.getPublishOptions(
        { my: "data" },
        "my-kind",
        fakeSerializer
      );

      expect(publishOptions.routingKey).toEqual("my-kind");
    });
  });

  describe("unwrap", () => {
    it("should return the payload given a message with a payload", () => {
      let msg = {
        payload: {
          my: "data",
        },
      };

      let data = envelope.unwrap(msg);

      let expected = {
        my: "data",
      };
      expect(data).toEqual(expected);
    });

    it("should return null given a message with no payload", () => {
      let msg = {};

      let data = envelope.unwrap(msg);

      expect(data).toEqual(null);
    });
  });

  describe("getMessageTypes", () => {
    it("should return the type property of the amqp properties as the only message type given a message with a type", () => {
      let msg = {
        properties: {
          type: "my-kind",
        },
      };

      let messageTypes = envelope.getMessageTypes(msg);

      expect(messageTypes).toEqual(["my-kind"]);
    });

    it("should return an empty array given a message with no type", () => {
      let msg = {};

      let messageTypes = envelope.getMessageTypes(msg);

      expect(messageTypes).toEqual([]);
    });
  });
});
