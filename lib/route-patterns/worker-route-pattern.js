const workerRoutePattern = ({
  noAck = false,
  durable = true,
  autoDelete = false,
  exclusive = false,
} = {}) => (topology, serviceDomainName, appName, routeName) => {
  let baseName = serviceDomainName + "." + appName + "." + routeName;
  let failedName = baseName + ".failed";

  return topology
    .createExchange({
      name: failedName,
      type: "fanout",
      durable,
      autoDelete,
    })
    .then(() =>
      topology.createQueue({
        name: failedName,
        durable,
        autoDelete,
        exclusive,
      })
    )
    .then(() =>
      topology.createBinding({
        source: failedName,
        target: failedName,
        queue: true,
      })
    )
    .then(() =>
      topology.createQueue({
        name: baseName,
        deadLetter: failedName,
        noAck: noAck,
        durable,
        autoDelete,
        exclusive,
      })
    )
    .then(() => ({ queueName: baseName }));
};

module.exports = workerRoutePattern;
