'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

module.exports = Actions;

function Actions(){
  EventEmitter.call(this);
}
util.inherits(Actions, EventEmitter);

Object.defineProperties(Actions.prototype, {
  next: {
    value: function(){
      this.emit('next');
    },
    enumerable: true
  },
  error: {
    value: function(err){
      this.emit('error', err);
    },
    enumerable: true
  }
});
