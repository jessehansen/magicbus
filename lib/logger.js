'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');

module.exports = Logger;

function Logger(){
  EventEmitter.call(this);
}
util.inherits(Logger, EventEmitter);

Logger.prototype.log = function Logger$log(kind, message) {
  this.emit('log', {kind: kind, message: message});
  this.emit('log:' + kind, message);
};

_.each(['debug', 'info', 'warn', 'error'], function(item){
  Logger.prototype[item] = function (message){
    this.log(item, message);
  };
});
