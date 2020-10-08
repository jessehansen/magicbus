const workerRoutePattern = require("../../lib/route-patterns/worker-route-pattern.js");

describe("WorkerRoutePattern", () => {
  let mockTopology;
  let routePattern;

  beforeEach(() => {
    mockTopology = {
      createExchange: jest.fn(() => Promise.resolve()),
      createQueue: jest.fn(() => Promise.resolve()),
      createBinding: jest.fn(() => Promise.resolve()),
    };

    routePattern = workerRoutePattern();
  });

  it("should assert a dead letter exchange", () => {
    return routePattern(mockTopology, "my-domain", "my-app", "my-route").then(
      () => {
        expect(mockTopology.createExchange).toHaveBeenCalledWith({
          name: "my-domain.my-app.my-route.failed",
          type: "fanout",
          durable: true,
          autoDelete: false,
        });
      }
    );
  });

  it("should create the dead letter exchange with passed options", () => {
    routePattern = workerRoutePattern({ durable: false, autoDelete: true });
    return routePattern(mockTopology, "my-domain", "my-app", "my-route").then(
      () => {
        expect(mockTopology.createExchange).toHaveBeenCalledWith({
          name: "my-domain.my-app.my-route.failed",
          type: "fanout",
          durable: false,
          autoDelete: true,
        });
      }
    );
  });

  it("should assert a queue to hold failed messages", () => {
    routePattern = workerRoutePattern({
      durable: false,
      autoDelete: true,
      exclusive: true,
      noAck: true,
    });
    return routePattern(mockTopology, "my-domain", "my-app", "my-route").then(
      () => {
        expect(mockTopology.createQueue).toHaveBeenCalledWith({
          name: "my-domain.my-app.my-route.failed",
          durable: false,
          autoDelete: true,
          exclusive: true,
        });
      }
    );
  });

  it("should create the failed message queue with passed options", () => {
    return routePattern(mockTopology, "my-domain", "my-app", "my-route").then(
      () => {
        expect(mockTopology.createQueue).toHaveBeenCalledWith({
          name: "my-domain.my-app.my-route.failed",
          durable: true,
          autoDelete: false,
          exclusive: false,
        });
      }
    );
  });

  it("should bind the failed message queue to the dead letter exchange", () => {
    return routePattern(mockTopology, "my-domain", "my-app", "my-route").then(
      () => {
        expect(mockTopology.createBinding).toHaveBeenCalledWith({
          source: "my-domain.my-app.my-route.failed",
          target: "my-domain.my-app.my-route.failed",
          queue: true,
        });
      }
    );
  });

  it("should assert the queue to consume from and connect it to the dead letter exchange", () => {
    return routePattern(mockTopology, "my-domain", "my-app", "my-route").then(
      () => {
        expect(mockTopology.createQueue).toHaveBeenCalledWith({
          name: "my-domain.my-app.my-route",
          deadLetter: "my-domain.my-app.my-route.failed",
          durable: true,
          autoDelete: false,
          exclusive: false,
          noAck: false,
        });
      }
    );
  });

  it("should return the name of the queue to consume from", () => {
    let p = routePattern(mockTopology, "my-domain", "my-app", "my-route");

    return expect(p).resolves.toEqual({
      queueName: "my-domain.my-app.my-route",
    });
  });

  it("should reject if any of the topology cannot be created", () => {
    mockTopology.createQueue = () => {
      return Promise.reject(new Error("Nuts!"));
    };

    return expect(
      routePattern(mockTopology, "my-domain", "my-app", "my-route")
    ).rejects.toThrow("Nuts!");
  });

  it("should create queue with passed options", () => {
    routePattern = workerRoutePattern({
      durable: false,
      autoDelete: true,
      exclusive: true,
      noAck: true,
    });
    return routePattern(mockTopology, "my-domain", "my-app", "my-route").then(
      () => {
        expect(mockTopology.createQueue).toHaveBeenCalledWith({
          name: "my-domain.my-app.my-route",
          deadLetter: "my-domain.my-app.my-route.failed",
          durable: false,
          autoDelete: true,
          exclusive: true,
          noAck: true,
        });
      }
    );
  });
});
