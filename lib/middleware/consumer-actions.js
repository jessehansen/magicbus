'use strict';

var util = require('util');
var Actions = require('./actions');

module.exports = ConsumerActions;

function ConsumerActions(){
  Actions.call(this);
}
util.inherits(ConsumerActions, Actions);

Object.defineProperties(ConsumerActions.prototype, {
  ack: {
    value: function(){
      this.emit('ack');
      this.emit('finished');
    },
    enumerable: true
  },
  nack: {
    value: function(){
      this.emit('nack');
      this.emit('finished');
    },
    enumerable: true
  },
  reject: {
    value: function(){
      this.emit('reject');
      this.emit('finished');
    },
    enumerable: true
  },
  reply: {
    value: function(response){
      this.emit('reply', response);
      this.emit('finished');
    },
    enumerable: true
  }
});
