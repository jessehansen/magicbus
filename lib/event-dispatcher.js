'use strict';

var assert = require('assert-plus');
var _ = require('lodash');
var Promise = require('bluebird');

module.exports = EventDispatcher;

function EventDispatcher() {
  this._buckets = [];
}

function _ensureRegExp(s) {
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

// dispatches events by calling handlers in series
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

  return eventNames.reduce(function(promise, eventName){
    return promise.then(function(result){
      var firstHandler = _.find(self._buckets, function(item){
        return item.pattern.test(eventName);
      });
      if (!firstHandler) {
        console.log('no handler for ' + eventName);
        return Promise.resolve(result);
      }
      console.log('found handler');
      return Promise.try(function(){
        return firstHandler.handler.apply(null, [eventName].concat(args));
      }).then(function(){
        console.log('completed handler for ' + eventName)
        return true;
      });
    });
  }, Promise.resolve(false));
};
