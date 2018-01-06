const eventDispatcherFactory = require('../lib/event-dispatcher')

const eventName = 'myCoolEventName'
const reallyBadEventName = '/\\^$*+?.()|[]{}'

describe('EventDispatcher', () => {
  const doNothing = () => {}
  let handlerFn
  let eventDispatcher
  let arg1 = {}
  let arg2 = []
  let arg3 = 'primitive'

  beforeEach(() => {
    eventDispatcher = eventDispatcherFactory()
    handlerFn = jest.fn()
  })

  describe('#on', () => {
    it('should not allow empty eventNames paramter', () => {
      expect(() => {
        eventDispatcher.on(null, doNothing)
      }).toThrow()
    })
    it('should not allow empty handler', () => {
      expect(() => {
        eventDispatcher.on('something', null)
      }).toThrow()
    })
    it('should not have trouble with strings containing regex special characters', () => {
      expect(() => {
        eventDispatcher.on(reallyBadEventName, doNothing)
      }).not.toThrow()
    })
  })

  describe('#once', () => {
    it('should not allow empty eventNames paramter', () => {
      expect(() => {
        eventDispatcher.once(null, doNothing)
      }).toThrow()
    })
    it('should not allow empty handler', () => {
      expect(() => {
        eventDispatcher.once('something', null)
      }).toThrow()
    })
    it('should not have trouble with strings containing regex special characters', () => {
      expect(() => {
        eventDispatcher.once(reallyBadEventName, doNothing)
      }).not.toThrow()
    })
  })

  describe('#dispatch', () => {
    it('should not allow no event name', () => {
      expect(() => {
        eventDispatcher.dispatch(null)
      }).toThrow()
      expect(() => {
        eventDispatcher.dispatch([])
      }).toThrow()
      expect(() => {
        eventDispatcher.dispatch('')
      }).toThrow()
    })
    it('should call handler when string event name matches event name exactly', () => {
      eventDispatcher.on(eventName, handlerFn)
      return eventDispatcher.dispatch(eventName).then((result) => {
        expect(result).toEqual(true)
        expect(handlerFn).toHaveBeenCalledWith(eventName)
      })
    })
    it('should not call handler when event name is a mismatch', () => {
      eventDispatcher.on(eventName, handlerFn)
      return expect(eventDispatcher.dispatch('myColdEventName', arg1, arg2, arg3)).resolves.toEqual(false)
    })
    it('should call regex handlers whenever they match', () => {
      eventDispatcher.on(/my.*EventName/, handlerFn)

      return eventDispatcher.dispatch(eventName).then((result) => {
        expect(result).toEqual(true)
        expect(handlerFn).toHaveBeenCalledWith(eventName)
      })
    })
    it('should not call regex handlers they do not match', () => {
      eventDispatcher.on(/your.*EventName/, handlerFn)

      return expect(eventDispatcher.dispatch(eventName)).resolves.toEqual(false)
    })
    it('should call handler registered with an array', () => {
      eventDispatcher.on([eventName, 'someOtherEventName'], handlerFn)

      return eventDispatcher.dispatch(eventName).then((result) => {
        expect(result).toEqual(true)
        expect(handlerFn).toHaveBeenCalledWith(eventName)
      })
    })
    it('should only call the first handler when multiple handlers match', () => {
      let secondHandler = jest.fn()
      eventDispatcher.on(eventName, handlerFn)
      eventDispatcher.on(/my.*EventName/, secondHandler)

      return eventDispatcher.dispatch(eventName).then((result) => {
        expect(result).toEqual(true)
        expect(handlerFn).toHaveBeenCalledWith(eventName)
        expect(secondHandler).not.toHaveBeenCalled()
      })
    })
    it('should call handlers with arguments', () => {
      eventDispatcher.on(eventName, handlerFn)

      return eventDispatcher.dispatch(eventName, arg1, arg2, arg3).then((result) => {
        expect(result).toEqual(true)
        expect(handlerFn).toHaveBeenCalledWith(eventName, arg1, arg2, arg3)
      })
    })
    it('should call handlers when multiple event types are passed', () => {
      eventDispatcher.on(eventName, handlerFn)

      return eventDispatcher.dispatch([eventName, 'myColdEventName'], arg1, arg2, arg3).then((result) => {
        expect(result).toEqual(true)
        expect(handlerFn).toHaveBeenCalledWith(eventName, arg1, arg2, arg3)
      })
    })
    it('should call handler only once when it is registered using once', () => {
      eventDispatcher.once(eventName, handlerFn)
      return eventDispatcher.dispatch(eventName).then((result) => {
        expect(result).toEqual(true)
        expect(handlerFn).toHaveBeenCalledTimes(1)
        return eventDispatcher.dispatch(eventName)
      }).then((result) => {
        expect(result).toEqual(false)
        expect(handlerFn).toHaveBeenCalledTimes(1)
      })
    })
    it('should resolve promise when handler is dispatched', () => {
      let promise = eventDispatcher.once(eventName, handlerFn)
      return eventDispatcher.dispatch(eventName).then(() => {
        expect(promise.then).toBeTruthy()
        return promise
      })
    })

    describe('error handling', () => {
      it('should return an error after a failing synchronous handler', () => {
        eventDispatcher.on(eventName, () => {
          throw new Error('my bad')
        })

        return expect(eventDispatcher.dispatch(eventName)).rejects.toThrow('my bad')
      })
      it('should return an error after a failing asynchronous handler', () => {
        eventDispatcher.on(eventName, () => {
          return Promise.reject(new Error('my bad'))
        })

        return expect(eventDispatcher.dispatch(eventName)).rejects.toThrow('my bad')
      })
    })
  })
})
