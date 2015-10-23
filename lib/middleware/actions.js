'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

module.exports = Actions;

function Actions(){
  EventEmitter.call(this);
}
util.inherits(Actions, EventEmitter);

Actions.prototype.next = function(){
  this.emit('next');
};
Actions.prototype.error = function(err){
  this.emit('error', err);
};

