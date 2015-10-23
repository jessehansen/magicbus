'use strict';

var util = require('util');
var Producer = require('./producer.js');

module.exports = Sender;

function Sender(broker, options) {
  Producer.call(this, broker, options);
}
util.inherits(Sender, Producer);
