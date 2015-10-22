'use strict';

var assert = require('assert-plus');
var Promise = require('bluebird');
var util = require('util');

module.exports = Pipeline;

function Pipeline(actions, pipe) {
  assert.object(actions);
  assert.func(actions.on);

  assert.optionalArrayOfFunc(pipe);

  this._pipe = (pipe || []).slice();
  this._actions = actions;
}

Pipeline.prototype = {
  use: function Pipeline$use(segment) {
    this._pipe.push(segment);
  },
  on: function Pipeline$on(evt, handler) {
    assert.string(evt, 'evt');
    assert.func(handler, 'handler');

    if (evt == 'next') {
      //internal event, don't expose
      return;
    }

    this._actions.on(evt, handler);
  },
  execute: function Pipeline$execute(message) {
    var pipe = this._pipe.slice();
    var actions = this._actions;

    return new Promise(function(resolve, reject) {
      actions.on('error', reject);
      actions.on('next', executeSegment);
      actions.on('finished', function(){
        resolve();
      });

      function executeSegment(){
        if (pipe.length){
          var segment = pipe.shift();
          segment(message, actions);
        } else {
          resolve();
        }
      }

      executeSegment();
    });
  }
};

Pipeline.withActions = function Pipeline$$withActions(actions) {
  var dynamicClass = function(pipe){
    Pipeline.call(this, actions, pipe);
  };
  util.inherits(dynamicClass, Pipeline);
  return dynamicClass;
};
