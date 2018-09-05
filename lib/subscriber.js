const Subscriber =  ({ consumer, eventDispatcher, logger, events }) => {
  const internalHandler = (context) => {
    let { messageTypes } = context
    logger.debug('Subscriber received message with types ' + JSON.stringify(messageTypes) + ', handing off to event dispatcher.')
    return eventDispatcher.dispatch(messageTypes, context)
      .catch((error) => {
        events.emit('unhandled-error', {
          messageTypes: messageTypes,
          message: context.message,
          error: error
        })
        logger.error('Error during message dispatch', error)
        return Promise.reject(error)
      })
      .then((executed) => {
        if (!executed) {
          events.emit('unhandled-event', {
            messageTypes: messageTypes,
            message: context.message
          })
          return Promise.reject(new Error('No handler registered'))
        }
        return Promise.resolve()
      })
  }
  const startSubscription = (options) => consumer.startConsuming(internalHandler, options)

  return {
    on: eventDispatcher.on,
    once: eventDispatcher.once,
    startSubscription: startSubscription,
    purgeQueue: consumer.purgeQueue,
    getBindingTarget: consumer.getBindingTarget
  }
}

module.exports = Subscriber
