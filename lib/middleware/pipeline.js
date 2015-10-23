'use strict';

var assert = require('assert-plus');
var Promise = require('bluebird');
var util = require('util');

module.exports = Pipeline;

function Pipeline(actionFactory, pipe) {
  assert.func(actionFactory, 'actionFactory');
  assert.optionalArrayOfFunc(pipe, 'pipe');

  this._pipe = (pipe || []).slice();
  this._actionFactory = actionFactory;
}

Pipeline.prototype = {
  use: function Pipeline$use(segment) {
    this._pipe.push(segment);
  },
  prepare: function Pipeline$prepare(register){
    assert.optionalFunc(register, 'register');

    var pipe = this._pipe.slice();
    var actions = this._actionFactory();
    if (register){
      register(actions);
    }

    return function Pipeline$prepare$execute(message){
      return new Promise(function(resolve, reject){
        actions.on('error', reject);
        actions.on('next', executeSegment);
        actions.on('finished', reject);

        executeSegment();

        function executeSegment(){
          if (pipe.length){
            var segment = pipe.shift();
            segment(message, actions);
          }
          else {
            resolve();
          }
        }
      });
    };
  }
};

Pipeline.withActionFactory = function Pipeline$$withActionFactory(actionFactory) {
  var dynamicClass = function(pipe){
    Pipeline.call(this, actionFactory, pipe);
  };
  util.inherits(dynamicClass, Pipeline);
  return dynamicClass;
};
