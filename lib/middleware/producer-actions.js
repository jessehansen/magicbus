'use strict';

var util = require('util');
var Actions = require('./actions');

function ProducerActions(){
  Actions.call(this);
}
util.inherits(ProducerActions, Actions);

// Producer has no distinct actions
module.exports = ProducerActions;
