let EventDispatcher = require('../lib/event-dispatcher')

let eventName = 'myCoolEventName'
let reallyBadEventName = '/\\^$*+?.()|[]{}'

let chai = require('chai')
let expect = chai.expect

let sinon = require('sinon')
let sinonChai = require('sinon-chai')
chai.use(sinonChai)

chai.use(require('chai-as-promised'))

describe('EventDispatcher', function () {
  let doNothing = function () {}
  let eventDispatcher
  let handlerSpy
  let arg1 = {}
  let arg2 = []
  let arg3 = 'primitive'

  beforeEach(function () {
    eventDispatcher = EventDispatcher()
    handlerSpy = sinon.spy()
  })

  describe('#on', function () {
    it('should not allow empty eventNames paramter', function () {
      expect(function () {
        eventDispatcher.on(null, doNothing)
      }).to.throw()
    })
    it('should not allow empty handler', function () {
      expect(function () {
        eventDispatcher.on('something', null)
      }).to.throw()
    })
    it('should not have trouble with strings containing regex special characters', function () {
      expect(function () {
        eventDispatcher.on(reallyBadEventName, doNothing)
      }).to.not.throw()
    })
  })

  describe('#once', function () {
    it('should not allow empty eventNames paramter', function () {
      expect(function () {
        eventDispatcher.once(null, doNothing)
      }).to.throw()
    })
    it('should not allow empty handler', function () {
      expect(function () {
        eventDispatcher.once('something', null)
      }).to.throw()
    })
    it('should not have trouble with strings containing regex special characters', function () {
      expect(function () {
        eventDispatcher.once(reallyBadEventName, doNothing)
      }).to.not.throw()
    })
  })

  describe('#dispatch', function () {
    it('should not allow no event name', function () {
      expect(function () {
        eventDispatcher.dispatch(null)
      }).to.throw()
      expect(function () {
        eventDispatcher.dispatch([])
      }).to.throw()
      expect(function () {
        eventDispatcher.dispatch('')
      }).to.throw()
    })
    it('should call handler when string event name matches event name exactly', function () {
      eventDispatcher.on(eventName, handlerSpy)
      return eventDispatcher.dispatch(eventName).then(function (result) {
        expect(result).to.equal(true)
        expect(handlerSpy).to.have.been.calledWith(eventName)
      })
    })
    it('should not call handler when event name is a mismatch', function () {
      eventDispatcher.on(eventName, handlerSpy)
      expect(eventDispatcher.dispatch('myColdEventName', arg1, arg2, arg3)).to.eventually.equal(false)
    })
    it('should call regex handlers whenever they match', function () {
      eventDispatcher.on(/my.*EventName/, handlerSpy)

      return eventDispatcher.dispatch(eventName).then(function (result) {
        expect(result).to.equal(true)
        expect(handlerSpy).to.have.been.calledWith(eventName)
      })
    })
    it('should not call regex handlers they do not match', function () {
      eventDispatcher.on(/your.*EventName/, handlerSpy)

      expect(eventDispatcher.dispatch(eventName)).to.eventually.equal(false)
    })
    it('should call handler registered with an array', function () {
      eventDispatcher.on([eventName, 'someOtherEventName'], handlerSpy)

      return eventDispatcher.dispatch(eventName).then(function (result) {
        expect(result).to.equal(true)
        expect(handlerSpy).to.have.been.calledWith(eventName)
      })
    })
    it('should only call the first handler when multiple handlers match', function () {
      let secondSpy = sinon.spy()
      eventDispatcher.on(eventName, handlerSpy)
      eventDispatcher.on(/my.*EventName/, secondSpy)

      return eventDispatcher.dispatch(eventName).then(function (result) {
        expect(result).to.equal(true)
        expect(handlerSpy).to.have.been.calledWith(eventName)
        expect(secondSpy).to.have.not.been.called
      })
    })
    it('should call handlers with arguments', function () {
      eventDispatcher.on(eventName, handlerSpy)

      return eventDispatcher.dispatch(eventName, arg1, arg2, arg3).then(function (result) {
        expect(result).to.equal(true)
        expect(handlerSpy).to.have.been.calledWith(eventName, arg1, arg2, arg3)
      })
    })
    it('should call handlers when multiple event types are passed', function () {
      eventDispatcher.on(eventName, handlerSpy)

      return eventDispatcher.dispatch([eventName, 'myColdEventName'], arg1, arg2, arg3).then(function (result) {
        expect(result).to.equal(true)
        expect(handlerSpy).to.have.been.calledWith(eventName, arg1, arg2, arg3)
      })
    })
    it('should call handler only once when it is registered using once', function () {
      eventDispatcher.once(eventName, handlerSpy)
      return eventDispatcher.dispatch(eventName).then(function (result) {
        expect(result).to.equal(true)
        expect(handlerSpy).to.have.been.calledOnce
        return eventDispatcher.dispatch(eventName)
      }).then(function (result) {
        expect(result).to.equal(false)
        expect(handlerSpy).to.have.been.calledOnce
      })
    })
    it('should resolve promise when handler is dispatched', function () {
      let promise = eventDispatcher.once(eventName, handlerSpy)
      return eventDispatcher.dispatch(eventName).then(function () {
        expect(promise.then).to.be.ok
        return promise
      })
    })

    describe('error handling', function () {
      it('should return an error after a failing synchronous handler', function () {
        eventDispatcher.on(eventName, function () {
          throw new Error('my bad')
        })

        return expect(eventDispatcher.dispatch(eventName)).to.eventually.be.rejectedWith('my bad')
      })
      it('should return an error after a failing asynchronous handler', function () {
        eventDispatcher.on(eventName, function () {
          return Promise.reject(new Error('my bad'))
        })

        return expect(eventDispatcher.dispatch(eventName)).to.eventually.be.rejectedWith('my bad')
      })
    })
  })
})
