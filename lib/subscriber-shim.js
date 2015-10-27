'use strict';

var assert = require('assert-plus');
var util = require('util');

var Subscriber = require('./subscriber');
var Consumer = require('./consumer');
var WorkerRoutePattern = require('./route-patterns/worker-route-pattern');
var EventDispatcher = require('./event-dispatcher.js');

module.exports = SubscriberShim;

function SubscriberShim(consumer, options){
  assert.object(consumer);

  assert.optionalObject(options);
  options = options || {};
  assert.optionalString(options.routeName, 'options.routeName');
  assert.optionalString(options.routePattern, 'options.routePattern');

  if (!(consumer instanceof Consumer)){
    var opts = {};
    opts.routeName = options.routeName || 'subscribe';
    opts.routePattern = options.routePattern || new WorkerRoutePattern();
    opts.envelope = options.envelope;
    consumer = new Consumer(consumer, opts);
  }

  Subscriber.call(this, consumer, new EventDispatcher());
}
util.inherits(SubscriberShim, Subscriber);
