const assert = require('assert-plus')
const Promise = require('bluebird')
const deferredPromise = require('./deferred-promise')

/**
 * Dispatches events to the correct handler
 *
 * @public
 * @constructor
 */
const createEventDispatcher = () => {
  let buckets = []

  const ensureRegExp = (s) => {
    if (s instanceof RegExp) {
      return s
    }
    return new RegExp('^' + s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '$')
  }

  /**
   * Subscribe to an event
   *
   * @public
   * @method
   * @param {String|RegEx|Array} eventNamesOrPatterns - name(s) of event, or pattern(s) for RegEx matching (required)
   * @param {Function} handler - event handler (required)
   */
  const on = (eventNamesOrPatterns, handler) => {
    if (!eventNamesOrPatterns) {
      throw new Error('Must pass at least one event name or matching RegEx')
    }
    assert.func(handler, 'handler')
    if (!Array.isArray(eventNamesOrPatterns)) {
      eventNamesOrPatterns = [eventNamesOrPatterns]
    }
    for (let i = 0; i < eventNamesOrPatterns.length; i++) {
      buckets.push({
        pattern: ensureRegExp(eventNamesOrPatterns[i]),
        handler: handler
      })
    }
  }

  /**
   * Subscribe to an event for one event only
   *
   * @public
   * @method
   * @param {String|RegEx|Array} eventNamesOrPatterns - name(s) of event, or pattern(s) for RegEx matching (required)
   * @param {Function} handler - event handler (required)
   * @returns {Promise} a promise that is fulfilled when the event has been processed
   */
  const once = (eventNamesOrPatterns, handler) => {
    if (!eventNamesOrPatterns) {
      throw new Error('Must pass at least one event name or matching RegEx')
    }
    assert.func(handler, 'handler')
    if (!Array.isArray(eventNamesOrPatterns)) {
      eventNamesOrPatterns = [eventNamesOrPatterns]
    }
    let deferred = deferredPromise()
    for (let i = 0; i < eventNamesOrPatterns.length; i++) {
      buckets.push({
        pattern: ensureRegExp(eventNamesOrPatterns[i]),
        handler: handler,
        once: deferred
      })
    }
    return deferred.promise
  }

  const getEventNames = (eventNames) => {
    if (!eventNames) {
      throw new Error('eventNames is required')
    } else if (!Array.isArray(eventNames)) {
      assert.string(eventNames)
      if (eventNames === '') {
        throw new Error('eventNames is required')
      }
      return [eventNames]
    }
    assert.arrayOfString(eventNames, 'eventNames')
    if (eventNames.length === 0) {
      throw new Error('eventNames is required')
    }
    return eventNames
  }

  /**
   * Dispatch events by calling handlers in series. If a handler throws an exception
   * (or an async handler returns a promise that is rejected), no other handlers will
   * be executed. All arguments sent to this method are passed to each handler
   *
   * @public
   * @method
   * @param {Array|String} eventNames - name(s) of the event to dispatch (required)
   * @returns {Promise} a promise that resolves when all handlers finish, or is rejected when any
        handler is rejected
   */
  const dispatch = (eventNames, ...args) => {
    let events = getEventNames(eventNames)

    return events.reduce((promise, eventName) => promise.then((result) => {
      let firstHandler = buckets.find((x) => x.pattern.test(eventName))

      if (!firstHandler) {
        return Promise.resolve(result)
      }
      return Promise.try(() =>
        firstHandler.handler(eventName, ...args)
      ).then(() => {
        if (firstHandler.once) {
          buckets = buckets.filter((item) => item !== firstHandler)
          firstHandler.once.resolve()
        }
        return true
      })
    }), Promise.resolve(false))
  }

  return {
    on,
    once,
    dispatch
  }
}

module.exports = createEventDispatcher
