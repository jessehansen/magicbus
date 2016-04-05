'use strict';

var Actions = require('./actions');

class ConsumerActions extends Actions{
  constructor(){
    super();
  }

  ack() {
    this.emit('ack');
    this.emit('finished');
  }

  nack() {
    this.emit('nack');
    this.emit('finished');
  }

  reject() {
    this.emit('reject');
    this.emit('finished');
  }
}

module.exports = ConsumerActions;
