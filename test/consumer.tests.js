const magicbus = require('..')
const EventEmitter = require('events').EventEmitter
const { tick } = require('../lib/util')

const Logger = require('../lib/logger')
const noOp = () => {}

describe('Consumer', () => {
  let mockBroker
  let logs
  let logEvents
  let logger
  let consumer

  let eventName
  let fakeMessage

  beforeEach(() => {
    logEvents = new EventEmitter()
    logs = []
    logger = Logger('magicbus.tests', logEvents)
    logEvents.on('log', (data) => {
      logs.push(data)
    })

    // The fake message needs to be real enough to thread the needle through the
    // envelope, serialization, and dispatch parts of the pipeline
    eventName = 'my-event'
    fakeMessage = {
      properties: {
        type: eventName
      },
      content: Buffer.from(JSON.stringify('the payload'))
    }

    let registeredConsumer = () => {}
    mockBroker = {
      consume: jest.fn((context, callback/* , options */) => {
        registeredConsumer = callback
      }),
      getTopologyParams: () => ({}),
      emulateConsumption: () =>
        new Promise((resolve) => {
          let ops = {
            ack: () => {
              fakeMessage.__resolution = 'ack'
              resolve()
            },
            nack: () => {
              fakeMessage.__resolution = 'nack'
              resolve()
            },
            reject: () => {
              fakeMessage.__resolution = 'reject'
              resolve()
            }
          }

          process.nextTick(() => {
            registeredConsumer(fakeMessage, ops)
          })
        })
    }
    consumer = magicbus.createConsumer(mockBroker, (cfg) =>
      cfg.useLogger(logger)
        .overrideFilters({ consume: [], input: [], output: [] })
    )
  })

  describe('#startConsuming', () => {
    it('should ack the message given a synchronous handler that does not throw', async () => {
      await consumer.startConsuming(noOp)
      await mockBroker.emulateConsumption()
      expect(fakeMessage.__resolution).toEqual('ack')
    })

    it('should reject the message given a synchronous handler that throws', async () => {
      let handler = function (/* handlerData, messageTypes, message */) {
        throw new Error('Aw, snap!')
      }

      await consumer.startConsuming(handler)
      await mockBroker.emulateConsumption()
      expect(logs.length).toBeGreaterThan(1)
      expect(logs.some((l) => l.err !== undefined)).toBeTruthy()
      expect(fakeMessage.__resolution).toEqual('reject')
    })

    it('should ack the message after the handler has completed given an asynchronous handler that resolves successfully', async () => {
      let handler = jest.fn((/* context */) => tick())

      await consumer.startConsuming(handler)
      await mockBroker.emulateConsumption()
      expect(fakeMessage.__resolution).toEqual('ack')
      expect(handler).toHaveBeenCalled()
    })

    it('should reject the message after the handler has completed given an asynchronous handler that rejects', async () => {
      let handler = (/* context */) =>
        tick().then(() => {
          throw new Error('Aw, snap!')
        })

      await consumer.startConsuming(handler)
      await mockBroker.emulateConsumption()
      expect(logs.length).toBeGreaterThan(1)
      expect(logs.some((l) => l.err !== undefined)).toBeTruthy()
      expect(fakeMessage.__resolution).toEqual('reject')
    })

    it('should nack if the handler requests it', async () => {
      let handler = (context) => {
        context.nack()
      }

      await consumer.startConsuming(handler)
      await mockBroker.emulateConsumption()
      expect(fakeMessage.__resolution).toEqual('nack')
    })

    it('should reject if the handler requests it', async () => {
      let handler = (context) => {
        context.reject()
      }

      await consumer.startConsuming(handler)
      await mockBroker.emulateConsumption()
      expect(fakeMessage.__resolution).toEqual('reject')
    })

    it('should fail if consume is called more than once', async () => {
      let handler = (context) => {
        context.reject()
      }

      await consumer.startConsuming(handler)
      await expect(consumer.startConsuming(handler)).rejects.toThrow('Already consuming')
    })

    describe('using middleware', () => {
      let mockFilter

      beforeEach(() => {
        mockFilter = jest.fn((ctx, next) => next(ctx))
      })

      it('should call consume middleware when starting consumption', async () => {
        consumer = magicbus.createConsumer(mockBroker, (cfg) =>
          cfg.useLogger(logger)
            .overrideFilters({ consume: [mockFilter], input: [], output: [] })
        )

        await consumer.startConsuming(noOp)
        expect(mockFilter).toHaveBeenCalledWith(expect.objectContaining({}), expect.any(Function))
      })

      it('should use topology from consume filter to start consumption on broker', async () => {
        const queue = 'some-queue'
        consumer = magicbus.createConsumer(mockBroker, (cfg) =>
          cfg.useLogger(logger)
            .overrideFilters({
              consume: [(ctx, next) =>
                next(Object.assign(ctx, { queue }))],
              input: [],
              output: []
            }))

        await consumer.startConsuming(noOp)
        expect(mockBroker.consume).toHaveBeenCalledWith(expect.objectContaining({ queue }), expect.any(Function))
      })

      it('should call message middleware in correct order', async () => {
        const middlewareCalls = []
        consumer = magicbus.createConsumer(mockBroker, (cfg) =>
          cfg.useLogger(logger)
            .overrideFilters({
              consume: [],
              input: [(ctx, next) => {
                middlewareCalls.push('input')
                return next(ctx)
              }],
              output: [(ctx, next) => {
                middlewareCalls.push('output')
                return next(ctx)
              }]
            }))
        await consumer.startConsuming(() => middlewareCalls.push('handler'))
        await mockBroker.emulateConsumption()
        expect(middlewareCalls).toEqual(['input', 'handler', 'output'])
      })
      it('should ack when middleware calls ack', () => {
        consumer = magicbus.createConsumer(mockBroker, (cfg) =>
          cfg.useLogger(logger)
            .overrideFilters({
              consume: [],
              input: [(ctx) => ctx.ack()],
              output: []
            }))
        let handler = jest.fn()
        consumer.startConsuming(handler)
        return mockBroker.emulateConsumption()
          .then(() => {
            expect(fakeMessage.__resolution).toEqual('ack')
            expect(handler).not.toHaveBeenCalled()
          })
      })

      it('should nack when middleware calls nack', () => {
        consumer = magicbus.createConsumer(mockBroker, (cfg) =>
          cfg.useLogger(logger)
            .overrideFilters({
              consume: [],
              input: [(ctx) => ctx.nack()],
              output: []
            }))
        let handler = jest.fn()
        consumer.startConsuming(handler)
        return mockBroker.emulateConsumption()
          .then(() => {
            expect(fakeMessage.__resolution).toEqual('nack')
            expect(handler).not.toHaveBeenCalled()
          })
      })

      it('should reject when middleware calls reject', () => {
        consumer = magicbus.createConsumer(mockBroker, (cfg) =>
          cfg.useLogger(logger)
            .overrideFilters({
              consume: [],
              input: [(ctx) => ctx.reject()],
              output: []
            }))
        let handler = jest.fn()
        consumer.startConsuming(handler)
        return mockBroker.emulateConsumption()
          .then(() => {
            expect(fakeMessage.__resolution).toEqual('reject')
            expect(handler).not.toHaveBeenCalled()
          })
      })
    })
  })
})
