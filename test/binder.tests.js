const magicbus = require("../lib");
const amqp = require("amqplib");
const environment = require("./_test-env");

const publisherRoutePattern = require("../lib/route-patterns/publisher-route-pattern");
const workerRoutePattern = require("../lib/route-patterns/worker-route-pattern");

describe("Binder really using RabbitMQ", () => {
  let serviceDomainName = "magicbus";
  let appName = "tests";
  let connectionInfo = environment.rabbit;
  let binder;

  beforeEach(() => {
    binder = magicbus.createBinder(connectionInfo);
  });

  afterEach(async () => {
    await binder.shutdown();
    let cxn = await amqp.connect(
      `amqp://${connectionInfo.user}:${connectionInfo.pass}@${connectionInfo.server}/`
    );
    let chn = await cxn.createChannel();
    await chn.deleteQueue(`${serviceDomainName}.${appName}.binder-subscribe`);
    await chn.deleteQueue(
      `${serviceDomainName}.${appName}.binder-subscribe.failed`
    );
    await chn.deleteExchange(`${serviceDomainName}.${appName}.binder-publish`);
    await cxn.close();
  });

  it("should be able to bind an exchange to a queue", () => {
    // TODO: Make these temporary
    return binder
      .bind(
        {
          serviceDomainName: serviceDomainName,
          appName: appName,
          name: "binder-publish",
          pattern: publisherRoutePattern(),
        },
        {
          serviceDomainName: serviceDomainName,
          appName: appName,
          name: "binder-subscribe",
          pattern: workerRoutePattern(),
        },
        { pattern: "#" }
      )
      .then(() => {
        expect(binder).toBeTruthy();
      });
  });
});
