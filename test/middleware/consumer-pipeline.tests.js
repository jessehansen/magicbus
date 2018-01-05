const ConsumerPipeline = require('../../lib/middleware').ConsumerPipeline

function simpleMiddleware (message, actions) {
  message.properties.headers.push('first: true')
  actions.next()
}

describe('ConsumerPipeline', function () {
  let consumerPipeline
  let message

  beforeEach(function () {
    consumerPipeline = new ConsumerPipeline()
    message = {
      properties: {
        headers: []
      },
      payload: 'data'
    }
  })

  describe('#useLogger', function () {
    it('should pass the logger on to middleware', function () {
      let sampleLogger = {}
      let middleware = jest.fn((m, a) => {
        a.next()
      })

      consumerPipeline.use(middleware)
      consumerPipeline.useLogger(sampleLogger)
      return consumerPipeline.prepare()(message)
        .then(() => {
          expect(middleware).toHaveBeenCalled()
          expect(middleware.mock.calls[0][0]).toBe(message)
          expect(middleware.mock.calls[0][2]).toBe(sampleLogger)
        })
    })
  })

  describe('#execute', function () {
    const successiveFunctionTestFactory =
      (fn) => async function () {
        const consumerPipeline = new ConsumerPipeline()
        consumerPipeline.use(function (msg, actions) {
          actions[fn]({})
        })
        consumerPipeline.use(simpleMiddleware)

        let pipe = consumerPipeline.prepare()
        await expect(pipe(message)).rejects.toBeUndefined()
        expect(message.properties.headers).toHaveLength(0)
      }
    const emitTestFactory =
      (fn) => async function () {
        let emitted = 0
        const consumerPipeline = new ConsumerPipeline()
        consumerPipeline.use(function (msg, actions) {
          actions[fn]({})
        })

        await expect(consumerPipeline.prepare(function (eventSink) {
          eventSink.on(fn, function () {
            emitted++
          })
        })(message)).rejects.toBeUndefined()
        expect(emitted).toEqual(1)
      }

    let funcs = ['ack', 'nack', 'reject']
    let i, fn
    for (i = 0; i < funcs.length; i++) {
      fn = funcs[i]
      it('should not call successive functions when middleware calls ' + fn, successiveFunctionTestFactory(fn))
      it('should emit event when middleware calls ' + fn, emitTestFactory(fn))
    }
  })
})
