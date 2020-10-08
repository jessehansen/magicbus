const existingTopologyRoutePattern = require("../../lib/route-patterns/existing-topology-route-pattern.js");

describe("ExistingTopologyRoutePattern", () => {
  let mockTopology;

  beforeEach(() => {
    mockTopology = {
      connectExchange: jest.fn(() => Promise.resolve()),
      connectQueue: jest.fn(() => Promise.resolve()),
    };
  });

  it("should connect an exchange when passed one", () => {
    let routePattern = existingTopologyRoutePattern({
      exchangeName: "my-exchange",
    });
    return routePattern(mockTopology).then(() => {
      expect(mockTopology.connectExchange).toHaveBeenCalledWith("my-exchange");
    });
  });

  it("should connect a queue when passed one", () => {
    let routePattern = existingTopologyRoutePattern({ queueName: "my-queue" });
    return routePattern(mockTopology).then(() => {
      expect(mockTopology.connectQueue).toHaveBeenCalledWith("my-queue");
    });
  });

  it("should support connecting exchanges and queues simultaneously", () => {
    let routePattern = existingTopologyRoutePattern({
      exchangeName: "my-exchange",
      queueName: "my-queue",
    });
    return routePattern(mockTopology).then(() => {
      expect(mockTopology.connectExchange).toHaveBeenCalledWith("my-exchange");
      expect(mockTopology.connectQueue).toHaveBeenCalledWith("my-queue");
    });
  });
});
