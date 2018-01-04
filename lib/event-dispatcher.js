const assert = require('assert-plus')
const _ = require('lodash')
const Promise = require('bluebird')
const DeferredPromise = require('./deferred-promise')

/**
 * Dispatches events to the correct handler
 *
 * @public
 * @constructor
 */
module.exports = function EventDispatcher () {
  let buckets = []

  function ensureRegExp (s) {
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
  function on (eventNamesOrPatterns, handler) {
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
  };

  /**
   * Subscribe to an event for one event only
   *
   * @public
   * @method
   * @param {String|RegEx|Array} eventNamesOrPatterns - name(s) of event, or pattern(s) for RegEx matching (required)
   * @param {Function} handler - event handler (required)
   * @returns {Promise} a promise that is fulfilled when the event has been processed
   */
  function once (eventNamesOrPatterns, handler) {
    if (!eventNamesOrPatterns) {
      throw new Error('Must pass at least one event name or matching RegEx')
    }
    assert.func(handler, 'handler')
    if (!Array.isArray(eventNamesOrPatterns)) {
      eventNamesOrPatterns = [eventNamesOrPatterns]
    }
    let deferred = DeferredPromise()
    for (let i = 0; i < eventNamesOrPatterns.length; i++) {
      buckets.push({
        pattern: ensureRegExp(eventNamesOrPatterns[i]),
        handler: handler,
        once: deferred
      })
    }
    return deferred.promise
  };

  function getEventNames (eventNames) {
    if (!eventNames) {
      throw new Error('eventNames is required')
    } else if (!_.isArray(eventNames)) {
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
  function dispatch (eventNames) {
    let args = []
    for (let i = 0; i < arguments.length; i++) {
      args.push(arguments[i])
    }
    args.shift()

    let events = getEventNames(eventNames)

    return events.reduce((promise, eventName) => promise.then((result) => {
      let firstHandler = buckets.find((x) => x.pattern.test(eventName))

      if (!firstHandler) {
        return Promise.resolve(result)
      }
      return Promise.try(function () {
        return firstHandler.handler.apply(null, [eventName].concat(args))
      }).then(function () {
        if (firstHandler.once) {
          _.remove(buckets, (item) => item === firstHandler)
          firstHandler.once.resolve()
        }
        return true
      })
    }), Promise.resolve(false))
  };

  return { on: on, once: once, dispatch: dispatch }
}
