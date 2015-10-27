'use strict';

var assert = require('assert-plus');
var _ = require('lodash');
var Promise = require('bluebird');

module.exports = EventDispatcher;

/**
 * Dispatches events to the correct handler
 *
 * @public
 * @constructor
 */
function EventDispatcher() {
  this._buckets = [];
}

function _ensureRegExp(s) {
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
EventDispatcher.prototype.on = function EventDispatcher$on(eventNamesOrPatterns, handler) {
  if (!eventNamesOrPatterns) {
    throw new Error('Must pass at least one event name or matching RegEx');
  }
  assert.func(handler, 'handler');
  if (!Array.isArray(eventNamesOrPatterns)) {
    eventNamesOrPatterns = [eventNamesOrPatterns];
  }
  for (var i = 0; i < eventNamesOrPatterns.length; i++) {
    this._buckets.push({
      pattern: _ensureRegExp(eventNamesOrPatterns[i]),
      handler: handler
    });
  }
};

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
EventDispatcher.prototype.dispatch = function EventDispatcher$dispatch(eventNames) {
  var self = this;
  var args = [];
  Array.prototype.push.apply(args, arguments);
  if (!eventNames) {
    throw new Error('eventNames is required');
  } else if (!Array.isArray(eventNames)) {
    assert.string(eventNames);
    if (eventNames === ''){
      throw new Error('eventNames is required');
    }
    eventNames = [eventNames];
  }
  assert.arrayOfString(eventNames, 'eventName');
  if (eventNames.length == 0){
    throw new Error('eventNames is required');
  }
  args.shift();

  var matches = _.flatten(eventNames.map(function(eventName) {
    return self._buckets.filter(function(item) {
      return item.pattern.test(eventName);
    }).map(function(item){
      return item.handler.bind(item, eventName);
    });
  }));

  if (matches.length === 0) {
    return Promise.resolve(false);
  }

  return matches.reduce(function(promise, item) {
    return promise.then(function() {
      return item.apply(null, args);
    });
  }, Promise.resolve()).then(function() {
    return true;
  });
};
