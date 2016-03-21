'use strict';

var assert = require('assert-plus');
var Promise = require('bluebird');
var util = require('util');

function Pipeline(actionFactory, pipe) {
  assert.func(actionFactory, 'actionFactory');
  assert.optionalArrayOfFunc(pipe, 'pipe');

  this._pipe = (pipe || []).slice();
  this._actionFactory = actionFactory;
}

Pipeline.prototype = {
  clone: function Pipeline$clone() {
    return new Pipeline(this._actionFactory, this._pipe);
  },
  use: function Pipeline$use(segment) {
    this._pipe.push(segment);
    return this;
  },
  prepare: function Pipeline$prepare(register){
    var pipe, actions;
    assert.optionalFunc(register, 'register');

    pipe = this._pipe.slice();
    actions = this._actionFactory();
    if (register){
      register(actions);
    }

    return function Pipeline$prepare$execute(message){
      return new Promise(function(resolve, reject){
        function executeSegment(){
          var segment;
          if (pipe.length){
            segment = pipe.shift();
            segment(message, actions);
          }
          else {
            resolve();
          }
        }

        actions.on('error', reject);
        actions.on('next', executeSegment);
        actions.on('finished', reject);

        executeSegment();
      });
    };
  }
};

Pipeline.withActionFactory = function Pipeline$$withActionFactory(actionFactory) {
  var dynamicClass = function (pipe){
    /* eslint no-invalid-this: 1 */
    Pipeline.call(this, actionFactory, pipe);
  };
  util.inherits(dynamicClass, Pipeline);
  return dynamicClass;
};

module.exports = Pipeline;
