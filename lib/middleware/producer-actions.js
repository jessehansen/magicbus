'use strict';

var util = require('util');
var Actions = require('./actions');

module.exports = ProducerActions;

function ProducerActions(){
  Actions.call(this);
}
util.inherits(ProducerActions, Actions);

// Producer has no distinct actions
