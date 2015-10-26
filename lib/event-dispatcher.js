'use strict';

var util = require('util');
var assert = require('assert-plus');

module.exports = EventDispatcher;

function EventDispatcher() {
  this._buckets = [];
}

function _ensureRegExp(s){
  if (s instanceof RegExp) {
    return s;
  }
  return new RegExp('^' + s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$');
}

EventDispatcher.prototype.on = function EventDispatcher$on(eventNamesOrPatterns, handler) {
  if (!eventNamesOrPatterns) {
    throw new Error('Must pass at least one event name or matching RegEx');
  }
  assert.func(handler, 'handler');
  if (!util.isArray(eventNamesOrPatterns)) {
    eventNamesOrPatterns = [eventNamesOrPatterns];
  }
  for (var i = 0; i < eventNamesOrPatterns.length; i++) {
    this._buckets.push({pattern: _ensureRegExp(eventNamesOrPatterns[i]), handler: handler});
  }
};

EventDispatcher.prototype.dispatch = function EventDispatcher$dispatch(eventName){
  assert.string(eventName, 'eventName');
  if (eventName === ''){
    throw new Error('eventName must not be zero-length');
  }
  for (var i = this._buckets.length - 1; i >= 0; i--) {
    var x = this._buckets[i];
    if (x.pattern.test(eventName)){
      x.handler.apply(null, arguments);
    }
  }
};
