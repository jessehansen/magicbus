'use strict';

var assert = require('assert-plus');
var util = require('util');

module.exports = Pipeline;

function Pipeline(actions, pipe) {
  assert.object(actions);
  assert.func(actions.on);

  assert.optionalArrayOfFunc(pipe);

  this._pipe = (pipe || []).slice();
  this._actions = actions;
}

Object.defineProperties(Pipeline.prototype, {
  use: {
    value: function Pipeline$use(segment) {
      this._pipe.push(segment);
    },
    enumerable: true
  },
  execute: {
    value: function Pipeline$execute(message) {
      var pipe = this._pipe.slice();
      var actions = this._actions;

      return new Promise(function(resolve, reject) {
        actions.on('reject', reject);
        actions.on('next', executeSegment);

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
    },
    enumerable: true
  }
});

Pipeline.withActions = function Pipeline$$withActions(actions) {
  var dynamicClass = function(pipe){
    Pipeline.call(this, actions, pipe);
  };
  util.inherits(dynamicClass, Pipeline);
  return dynamicClass;
};
