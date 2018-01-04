
const ConsumerPipeline = require('../../lib/middleware').ConsumerPipeline

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const expect = chai.expect
const assert = chai.assert
const sinon = require('sinon')

chai.use(chaiAsPromised)

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
      let middleware = sinon.spy((m, a) => {
        a.next()
      })

      consumerPipeline.use(middleware)
      consumerPipeline.useLogger(sampleLogger)
      return consumerPipeline.prepare()(message)
        .then(() => {
          expect(middleware).to.have.been.called
          expect(middleware).to.have.been.calledWith(message, sinon.match.object, sampleLogger)
        })
    })
  })

  describe('#execute', function () {
    let funcs = ['ack', 'nack', 'reject']
    let i, fn
    for (i = 0; i < funcs.length; i++) {
      fn = funcs[i]
      /* eslint no-loop-func: 1 */
      it('should not call successive functions when middleware calls ' + fn, function () {
        consumerPipeline = new ConsumerPipeline()
        consumerPipeline.use(function (msg, actions) {
          actions[fn]({})
        })
        consumerPipeline.use(simpleMiddleware)

        return consumerPipeline.prepare()(message).then(function () {
          assert.fail('expected promise to fail, but it succeeded')
        }).catch(function () {
          expect(message.properties.headers.length).to.equal(0)
        })
      })
      it('should emit event when middleware calls ' + fn, function () {
        let emitted
        consumerPipeline = new ConsumerPipeline()
        consumerPipeline.use(function (msg, actions) {
          actions[fn]({})
        })

        emitted = 0

        return consumerPipeline.prepare(function (eventSink) {
          eventSink.on(fn, function () {
            emitted++
          })
        })(message).then(function () {
          assert.fail('expected promise to fail, but it succeeded')
        }).catch(function () {
          expect(emitted).to.equal(1)
        })
      })
    }
  })
})
