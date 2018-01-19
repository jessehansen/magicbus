const MessageContext = (properties = {}) => {
  let outcome
  const i = {
    outcome (requested) {
      if (requested && !outcome) {
        outcome = requested
      }
      return outcome
    }
  }
  return Object.assign({
    ack: () => i.outcome('ack'),
    nack: () => i.outcome('nack'),
    reject: () => i.outcome('reject'),
    outcome: () => i.outcome()
  }, properties)
}

module.exports = MessageContext
