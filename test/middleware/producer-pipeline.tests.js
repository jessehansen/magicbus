
const sinon = require('sinon')
const ProducerPipeline = require('../../lib/middleware').ProducerPipeline

const chai = require('chai')
const expect = chai.expect
const assert = chai.assert
const chaiAsPromised = require('chai-as-promised')

chai.use(chaiAsPromised)

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
      expect(message.properties.headers.length).to.equal(1)
      clone.prepare()(message)
      expect(message.properties.headers.length).to.equal(3)
    })
  })

  describe('#use', function () {
    it('should return pipeline for chaining', function () {
      expect(producerPipeline.use(simpleMiddleware)).to.equal(producerPipeline)
    })
  })

  describe('#useLogger', function () {
    it('should pass the logger on to middleware', function () {
      let sampleLogger = {}
      let middleware = sinon.spy((m, a) => {
        a.next()
      })

      producerPipeline.use(middleware)
      producerPipeline.useLogger(sampleLogger)
      return producerPipeline.prepare()(message)
        .then(() => {
          expect(middleware).to.have.been.called
          expect(middleware).to.have.been.calledWith(message, sinon.match.object, sampleLogger)
        })
    })
  })

  describe('#execute', function () {
    it('should eventually fulfill promise', function () {
      return expect(producerPipeline.prepare()(message)).to.eventually.be.fulfilled
    })
    it('should call middleware function once when it is given one', function () {
      producerPipeline.use(simpleMiddleware)
      return producerPipeline.prepare()(message).then(function () {
        expect(message.properties.headers.length).to.equal(1)
        expect(message.properties.headers[0]).to.equal('first: true')
      })
    })
    it('should call middleware functions in succession when given multiple', function () {
      producerPipeline.use(simpleMiddleware)
      producerPipeline.use(secondMiddleware)
      return producerPipeline.prepare()(message).then(function () {
        expect(message.properties.headers.length).to.equal(2)
        expect(message.properties.headers[0]).to.equal('first: true')
        expect(message.properties.headers[1]).to.equal('second: true')
      })
    })
    it('should reject promise when error occurs', function () {
      producerPipeline.use(errorMiddleware)
      return expect(producerPipeline.prepare()(message)).to.eventually.be.rejectedWith('oh crap')
    })
    it('should not call successive functions when middleware errors', function () {
      producerPipeline.use(errorMiddleware)
      producerPipeline.use(simpleMiddleware)
      producerPipeline.use(secondMiddleware)
      return producerPipeline.prepare()(message).then(function () {
        assert.fail('expected promise to fail, but it succeeded')
      }).catch(function () {
        expect(message.properties.headers.length).to.equal(0)
      })
    })
    it('should not impact past messages', function () {
      let msg1 = { properties: { headers: [] } }
      let msg2 = { properties: { headers: [] } }
      producerPipeline.use(simpleMiddleware)
      return producerPipeline.prepare()(msg1).then(function () {
        producerPipeline.prepare()(msg2)
      }).then(function () {
        expect(msg1.properties.headers.length).to.equal(1)
        expect(msg2.properties.headers.length).to.equal(1)
      })
    })
  })
})
