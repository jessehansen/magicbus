const EventDispatcher = require('../lib/event-dispatcher')

const eventName = 'myCoolEventName'
const reallyBadEventName = '/\\^$*+?.()|[]{}'

describe('EventDispatcher', function () {
  const doNothing = function () {}
  let handlerFn
  let eventDispatcher
  let arg1 = {}
  let arg2 = []
  let arg3 = 'primitive'

  beforeEach(function () {
    eventDispatcher = EventDispatcher()
    handlerFn = jest.fn()
  })

  describe('#on', function () {
    it('should not allow empty eventNames paramter', function () {
      expect(function () {
        eventDispatcher.on(null, doNothing)
      }).toThrow()
    })
    it('should not allow empty handler', function () {
      expect(function () {
        eventDispatcher.on('something', null)
      }).toThrow()
    })
    it('should not have trouble with strings containing regex special characters', function () {
      expect(function () {
        eventDispatcher.on(reallyBadEventName, doNothing)
      }).not.toThrow()
    })
  })

  describe('#once', function () {
    it('should not allow empty eventNames paramter', function () {
      expect(function () {
        eventDispatcher.once(null, doNothing)
      }).toThrow()
    })
    it('should not allow empty handler', function () {
      expect(function () {
        eventDispatcher.once('something', null)
      }).toThrow()
    })
    it('should not have trouble with strings containing regex special characters', function () {
      expect(function () {
        eventDispatcher.once(reallyBadEventName, doNothing)
      }).not.toThrow()
    })
  })

  describe('#dispatch', function () {
    it('should not allow no event name', function () {
      expect(function () {
        eventDispatcher.dispatch(null)
      }).toThrow()
      expect(function () {
        eventDispatcher.dispatch([])
      }).toThrow()
      expect(function () {
        eventDispatcher.dispatch('')
      }).toThrow()
    })
    it('should call handler when string event name matches event name exactly', function () {
      eventDispatcher.on(eventName, handlerFn)
      return eventDispatcher.dispatch(eventName).then(function (result) {
        expect(result).toEqual(true)
        expect(handlerFn).toHaveBeenCalledWith(eventName)
      })
    })
    it('should not call handler when event name is a mismatch', function () {
      eventDispatcher.on(eventName, handlerFn)
      return expect(eventDispatcher.dispatch('myColdEventName', arg1, arg2, arg3)).resolves.toEqual(false)
    })
    it('should call regex handlers whenever they match', function () {
      eventDispatcher.on(/my.*EventName/, handlerFn)

      return eventDispatcher.dispatch(eventName).then(function (result) {
        expect(result).toEqual(true)
        expect(handlerFn).toHaveBeenCalledWith(eventName)
      })
    })
    it('should not call regex handlers they do not match', function () {
      eventDispatcher.on(/your.*EventName/, handlerFn)

      return expect(eventDispatcher.dispatch(eventName)).resolves.toEqual(false)
    })
    it('should call handler registered with an array', function () {
      eventDispatcher.on([eventName, 'someOtherEventName'], handlerFn)

      return eventDispatcher.dispatch(eventName).then(function (result) {
        expect(result).toEqual(true)
        expect(handlerFn).toHaveBeenCalledWith(eventName)
      })
    })
    it('should only call the first handler when multiple handlers match', function () {
      let secondHandler = jest.fn()
      eventDispatcher.on(eventName, handlerFn)
      eventDispatcher.on(/my.*EventName/, secondHandler)

      return eventDispatcher.dispatch(eventName).then(function (result) {
        expect(result).toEqual(true)
        expect(handlerFn).toHaveBeenCalledWith(eventName)
        expect(secondHandler).not.toHaveBeenCalled()
      })
    })
    it('should call handlers with arguments', function () {
      eventDispatcher.on(eventName, handlerFn)

      return eventDispatcher.dispatch(eventName, arg1, arg2, arg3).then(function (result) {
        expect(result).toEqual(true)
        expect(handlerFn).toHaveBeenCalledWith(eventName, arg1, arg2, arg3)
      })
    })
    it('should call handlers when multiple event types are passed', function () {
      eventDispatcher.on(eventName, handlerFn)

      return eventDispatcher.dispatch([eventName, 'myColdEventName'], arg1, arg2, arg3).then(function (result) {
        expect(result).toEqual(true)
        expect(handlerFn).toHaveBeenCalledWith(eventName, arg1, arg2, arg3)
      })
    })
    it('should call handler only once when it is registered using once', function () {
      eventDispatcher.once(eventName, handlerFn)
      return eventDispatcher.dispatch(eventName).then(function (result) {
        expect(result).toEqual(true)
        expect(handlerFn).toHaveBeenCalledTimes(1)
        return eventDispatcher.dispatch(eventName)
      }).then(function (result) {
        expect(result).toEqual(false)
        expect(handlerFn).toHaveBeenCalledTimes(1)
      })
    })
    it('should resolve promise when handler is dispatched', function () {
      let promise = eventDispatcher.once(eventName, handlerFn)
      return eventDispatcher.dispatch(eventName).then(function () {
        expect(promise.then).toBeTruthy()
        return promise
      })
    })

    describe('error handling', function () {
      it('should return an error after a failing synchronous handler', function () {
        eventDispatcher.on(eventName, function () {
          throw new Error('my bad')
        })

        return expect(eventDispatcher.dispatch(eventName)).rejects.toThrow('my bad')
      })
      it('should return an error after a failing asynchronous handler', function () {
        eventDispatcher.on(eventName, function () {
          return Promise.reject(new Error('my bad'))
        })

        return expect(eventDispatcher.dispatch(eventName)).rejects.toThrow('my bad')
      })
    })
  })
})
