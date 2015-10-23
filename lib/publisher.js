'use strict';

var util = require('util');
var Producer = require('./producer.js');

module.exports = Publisher;

function Publisher(broker, options) {
  Producer.call(this, broker, options);
}
util.inherits(Publisher, Producer);
