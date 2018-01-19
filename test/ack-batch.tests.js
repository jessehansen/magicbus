const AckBatch = require('../lib/ack-batch')
const Logger = require('../lib/logger')
const signal = require('postal').channel('rabbit.ack')
const { tick } = require('../lib/util')

describe('AckBatch', () => {
  const name = 'default'
  const connectionName = 'default'
  let resolver
  let logger
  let batch
  let tag1
  let tag2
  let tag3
  let ops1
  let ops2
  let ops3

  beforeEach(() => {
    resolver = jest.fn(() => Promise.resolve())
    logger = Logger()
    batch = AckBatch(name, connectionName, resolver, logger)
    tag1 = 1
    tag2 = 2
    tag3 = 3
    ops1 = batch.getMessageOps(tag1)
    ops2 = batch.getMessageOps(tag2)
    ops3 = batch.getMessageOps(tag3)

    batch.listenForSignal()

    // logger.on('log', ({ kind, namespace, message, err }) =>
    //   err
    //     ? console.log(namespace, kind, message, err)
    //     : console.log(namespace, kind, message))
  })

  it('should allow adding messages', () => {
    batch.addMessage(ops1.message)

    expect(batch.messages).toHaveLength(1)
  })

  it('should handle multiple listen calls', () => {
    batch.listenForSignal()
  })

  it('should be able to ignore the signal', () => {
    batch.ignoreSignal()
  })

  it('should keep count of added messages', () => {
    batch.addMessage(ops1.message)

    expect(batch.receivedCount).toEqual(1)
  })

  it('should not notify resolver when waiting', async () => {
    signal.publish('ack')
    await tick()

    expect(resolver).not.toHaveBeenCalled()
  })

  it('flush should resolve when no messages are added', async () => {
    await expect(batch.flush()).resolves.toBeUndefined()
  })

  it('flush should resolve when messages are added during flush', async () => {
    batch.addMessage(ops1.message)
    ops1.ack()
    await tick()
    let flushed = batch.flush()
    batch.addMessage(ops2.message)
    ops2.ack()
    await tick()

    await expect(flushed).resolves.toBeUndefined()
  })

  describe('with added messages', () => {
    beforeEach(() => {
      batch.addMessage(ops1.message)
      batch.addMessage(ops2.message)
      batch.addMessage(ops3.message)
    })

    const createTestForSeparateResolutions = (resolution) => async () => {
      ops1[resolution]()
      signal.publish('ack')
      await tick()
      ops2[resolution]()
      signal.publish('ack')
      await tick()
      ops3[resolution]()
      signal.publish('ack')
      await tick()

      expect(resolver).toHaveBeenCalledTimes(3)
      expect(resolver).toHaveBeenCalledWith(resolution, { tag: tag1, inclusive: true })
      expect(resolver).toHaveBeenCalledWith(resolution, { tag: tag2, inclusive: true })
      expect(resolver).toHaveBeenCalledWith(resolution, { tag: tag3, inclusive: true })
    }

    const createTestForBatchResolution = (resolution) => async () => {
      ops1[resolution]()
      ops2[resolution]()
      ops3[resolution]()

      signal.publish('ack')

      await tick()

      expect(resolver).toHaveBeenCalledTimes(1)
      expect(resolver).toHaveBeenCalledWith(resolution, { tag: tag3, inclusive: true })
    }

    ['ack', 'nack', 'reject'].forEach((resolution) => {
      it(`ack signal should ${resolution} separately when messages are ${resolution}ed separately`,
        createTestForSeparateResolutions(resolution))
      it(`ack signal should ${resolution} together when messages are all ${resolution}ed`,
        createTestForBatchResolution(resolution))
    })

    it('ack signal should wait when first message is pending', async () => {
      ops2.ack()
      ops3.ack()

      signal.publish('ack')

      await tick()

      expect(resolver).toHaveBeenCalledTimes(0)
    })

    it('ack signal should process in sequences when resolutions are mixed', async () => {
      ops1.ack()
      ops2.ack()
      ops3.nack()

      signal.publish('ack')
      await tick()

      expect(resolver).toHaveBeenCalledTimes(2)
      expect(resolver).toHaveBeenCalledWith('ack', { tag: tag2, inclusive: true })
      expect(resolver).toHaveBeenCalledWith('nack', { tag: tag3, inclusive: true })
    })

    it('should not misbehave when the resolver has issues', async () => {
      ops1.ack()
      ops2.ack()
      ops3.nack()

      resolver.mockImplementationOnce(() => Promise.reject('no ack for you!'))

      signal.publish('ack')
      await tick()

      expect(resolver).toHaveBeenCalledTimes(1)
    })

    it('executing flush in parallel should not cause issues', async () => {
      await Promise.all([batch.flush(), batch.flush()])
    })
  })
})
