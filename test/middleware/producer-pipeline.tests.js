const ProducerPipeline = require('../../lib/middleware').ProducerPipeline

function simpleMiddleware (message, actions) {
  message.properties.headers.push('first: true')
  actions.next()
}
function secondMiddleware (message, actions) {
  message.properties.headers.push('second: true')
  actions.next()
}
function errorMiddleware (message, actions) {
  actions.error(new Error('oh crap'))
}

describe('ProducerPipeline', function () {
  let producerPipeline
  let message

  beforeEach(function () {
    producerPipeline = new ProducerPipeline()
    message = {
      properties: {
        headers: []
      },
      payload: 'data'
    }
  })

  describe('#clone', function () {
    it('should return equivalent (but separate) pipeline', function () {
      let clone
      producerPipeline.use(simpleMiddleware)
      clone = producerPipeline.clone()
      clone.use(secondMiddleware)

      producerPipeline.prepare()(message)
      expect(message.properties.headers).toHaveLength(1)
      clone.prepare()(message)
      expect(message.properties.headers).toHaveLength(3)
    })
  })

  describe('#use', function () {
    it('should return pipeline for chaining', function () {
      expect(producerPipeline.use(simpleMiddleware)).toEqual(producerPipeline)
    })
  })

  describe('#useLogger', function () {
    it('should pass the logger on to middleware', function () {
      let sampleLogger = {}
      let middleware = jest.fn((m, a) => {
        a.next()
      })

      producerPipeline.use(middleware)
      producerPipeline.useLogger(sampleLogger)
      return producerPipeline.prepare()(message)
        .then(() => {
          expect(middleware).toHaveBeenCalled()
          expect(middleware.mock.calls[0][0]).toBe(message)
          expect(middleware.mock.calls[0][2]).toBe(sampleLogger)
        })
    })
  })

  describe('#execute', function () {
    it('should eventually fulfill promise', function () {
      return expect(producerPipeline.prepare()(message)).resolves.toBeUndefined()
    })
    it('should call middleware function once when it is given one', function () {
      producerPipeline.use(simpleMiddleware)
      return producerPipeline.prepare()(message).then(function () {
        expect(message.properties.headers).toHaveLength(1)
        expect(message.properties.headers[0]).toEqual('first: true')
      })
    })
    it('should call middleware functions in succession when given multiple', function () {
      producerPipeline.use(simpleMiddleware)
      producerPipeline.use(secondMiddleware)
      return producerPipeline.prepare()(message).then(function () {
        expect(message.properties.headers).toHaveLength(2)
        expect(message.properties.headers[0]).toEqual('first: true')
        expect(message.properties.headers[1]).toEqual('second: true')
      })
    })
    it('should reject promise when error occurs', function () {
      producerPipeline.use(errorMiddleware)
      return expect(producerPipeline.prepare()(message)).rejects.toThrow('oh crap')
    })
    it('should not call successive functions when middleware errors', async function () {
      producerPipeline.use(errorMiddleware)
      producerPipeline.use(simpleMiddleware)
      producerPipeline.use(secondMiddleware)
      await expect(producerPipeline.prepare()(message)).rejects.toThrow()
      expect(message.properties.headers).toHaveLength(0)
    })
    it('should not impact past messages', function () {
      let msg1 = { properties: { headers: [] } }
      let msg2 = { properties: { headers: [] } }
      producerPipeline.use(simpleMiddleware)
      return producerPipeline.prepare()(msg1).then(function () {
        producerPipeline.prepare()(msg2)
      }).then(function () {
        expect(msg1.properties.headers).toHaveLength(1)
        expect(msg2.properties.headers).toHaveLength(1)
      })
    })
  })
})
