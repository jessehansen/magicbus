'use strict';

var assert = require('assert-plus');
var util = require('util');

var Subscriber = require('./subscriber');
var Receiver = require('./receiver');
var WorkerRoutePattern = require('./route-patterns/worker-route-pattern');

module.exports = SubscriberShim;

function SubscriberShim(receiver, options){
  assert.object(receiver);

  assert.optionalObject(options);
  assert.optionalString(options.routeName, 'options.routeName');
  assert.optionalString(options.routePattern, 'options.routePattern');

  if (!(receiver instanceof Receiver)){
    var opts = {};
    opts.routeName = options.routeName || 'subscribe';
    opts.routePattern = options.routePattern || new WorkerRoutePattern();
    receiver = new Receiver(receiver, opts);
  }

  Subscriber.call(receiver, options);
}
util.inherits(SubscriberShim, Subscriber);
