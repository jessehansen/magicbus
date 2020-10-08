// initial version from https://github.com/LeanKit-Labs/wascally

const AmqpChannel = require("amqplib/lib/callback_model").Channel;
const machineFactory = require("./machine-factory");

const close = (channel) => channel.close && channel.close();

/**
 * Creates an amqp channel state machine that handles connection state changes.
 * @param {Object} connection - the connection
 * @param {bool} confirm - should channel be a ConfirmChannel or Channel
 * @param {Object} logger - the logger
 * @returns {Object} a state machine with all of the amqplib.Channel functions exposed on it
 */
const channelMachineFactory = (connection, confirm, logger) => {
  let method = confirm ? "createConfirmChannel" : "createChannel";
  let log = logger.withNamespace("channel");
  logger.silly(`Creating channel using ${method}`);
  const factory = () => {
    if (connection.state === "released") {
      connection.acquire();
    }
    return connection[method]();
  };
  const channelMachine = machineFactory(
    factory,
    AmqpChannel,
    close,
    "close",
    ["ack", "nack", "reject"],
    log
  );
  connection.on("releasing", () => channelMachine.release());
  return channelMachine;
};

module.exports = channelMachineFactory;
