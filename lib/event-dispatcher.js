'use strict';

const assert = require('assert-plus');
const _ = require('lodash');
const Promise = require('bluebird');

/**
 * Dispatches events to the correct handler
 *
 * @public
 * @constructor
 */
module.exports = function EventDispatcher() {
  let buckets = [];

  function ensureRegExp(s) {
    if (s instanceof RegExp) {
      return s;
    }
    return new RegExp('^' + s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$');
  }

  /**
   * Subscribe to an event
   *
   * @public
   * @method
   * @param {String|RegEx|Array} eventNamesOrPatterns - name(s) of event, or pattern(s) for RegEx matching (required)
   * @param {Function} handler - event handler (required)
   */
  function on(eventNamesOrPatterns, handler) {
    var i;
    if (!eventNamesOrPatterns) {
      throw new Error('Must pass at least one event name or matching RegEx');
    }
    assert.func(handler, 'handler');
    if (!Array.isArray(eventNamesOrPatterns)) {
      eventNamesOrPatterns = [eventNamesOrPatterns];
    }
    for (i = 0; i < eventNamesOrPatterns.length; i++) {
      buckets.push({
        pattern: ensureRegExp(eventNamesOrPatterns[i]),
        handler: handler
      });
    }
  };

  function getEventNames(eventNames){
    eventNames;
    if (!eventNames) {
      throw new Error('eventNames is required');
    } else if (!_.isArray(eventNames)) {
      assert.string(eventNames);
      if (eventNames === ''){
        throw new Error('eventNames is required');
      }
      return [eventNames];
    }
    assert.arrayOfString(eventNames, 'eventNames');
    if (eventNames.length === 0){
      throw new Error('eventNames is required');
    }
    return eventNames;
  }

  /**
   * Dispatch events by calling handlers in series. If a handler throws an exception
   * (or an async handler returns a promise that is rejected), no other handlers will
   * be executed. All arguments sent to this method are passed to each handler
   *
   * @public
   * @method
   * @param {Array|String} eventNames - name(s) of the event to dispatch (required)
   * @returns {Promise} a promise that resolves when all handlers finish, or is rejected when the any handler is rejected
   */
  function dispatch(eventNames) {
    var args = [];
    for (let i = 0; i < arguments.length; i++){
      args.push(arguments[i]);
    }
    args.shift();

    let events = getEventNames(eventNames);

    return events.reduce((promise, eventName) => {
      return promise.then((result) => {
        var firstHandler = _.find(buckets, function(item){
          return item.pattern.test(eventName);
        });
        if (!firstHandler) {
          return Promise.resolve(result);
        }
        return Promise.try(function(){
          let result = firstHandler.handler.apply(null, [eventName].concat(args));
          if (firstHandler.once) {
            buckets = _.remove(buckets, firstHandler);
          }
          return result;
        }).then(function(){
          return true;
        });
      });
    }, Promise.resolve(false));
  };

  return { on: on, dispatch: dispatch };

};
