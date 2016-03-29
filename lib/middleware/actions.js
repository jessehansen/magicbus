'use strict';

const EventEmitter = require('events').EventEmitter;

class Actions extends EventEmitter {
  constructor(){
    super();
  }

  next(){
    this.emit('next');
  }

  error(err){
    this.emit('error', err);
  }
}

module.exports = Actions;
