const shortid = require("shortid");

const listenerRoutePattern = ({
  noAck = false,
  durable = true,
  autoDelete = false,
} = {}) => (topology, serviceDomainName, appName, routeName) => {
  let baseName = serviceDomainName + "." + appName + "." + routeName;
  let randomListenerName = baseName + ".listener-" + shortid.generate();

  return topology
    .createExchange({
      name: baseName,
      type: "fanout",
      durable,
      autoDelete,
    })
    .then(() =>
      topology.createQueue({
        name: randomListenerName,
        exclusive: true,
        durable: false,
        autoDelete: true,
        noAck,
      })
    )
    .then(() =>
      topology.createBinding({
        source: baseName,
        target: randomListenerName,
      })
    )
    .then(() => ({
      queueName: randomListenerName,
    }));
};

module.exports = listenerRoutePattern;
