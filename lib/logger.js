'use strict';

var _ = require('lodash');
const EventEmitter = require('events').EventEmitter;
// soon to be replaced with @leisurelink/skinny-event-logger
function Logger(eventSink, scope){
  this.eventSink = eventSink || new EventEmitter();
  if (scope) {
    this.scope = scope;
  }
}

Logger.prototype.log = function Logger$log(kind, message, err) {
  var data = { kind: kind, message: message };
  if (err) {
    data.err = err;
  }
  if (this.scope) {
    this.eventSink.emit(this.scope + ':log', data);
    this.eventSink.emit(this.scope + ':log:' + kind, message);
    data.scope = this.scope;
  }
  this.eventSink.emit('log', data);
  this.eventSink.emit('log:' + kind, message);
};

_.each(['debug', 'info', 'warn', 'error'], function(item){
  Logger.prototype[item] = function (message, err){
    this.log(item, message, err);
  };
});

Logger.prototype.scoped = function Logger$scoped(scope) {
  var s = this.scope ? this.scope + ':' + scope : scope;
  return new Logger(this.eventSink, s);
};

module.exports = Logger;
