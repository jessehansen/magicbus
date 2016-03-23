'use strict';


var assert = require('assert-plus');

var Broker = require('../broker');

var PublisherConfigurator = require('./publisher-configurator');
var Publisher = require('../publisher');

var ConsumerConfigurator = require('./consumer-configurator');
var Consumer = require('../consumer');

var SubscriberConfigurator = require('./subscriber-configurator');
var Subscriber = require('../subscriber');

var Binder = require('../binder');

function Configurator(logger) {
  this._logger = logger;
}

Configurator.prototype._getParams = function Configurator$getParams(configClass, configurator) {
  var config = new configClass(this);
  if (configurator) {
    configurator(config);
  }
  return config.getParams();
};

Configurator.prototype.extend = function Configurator$extend(configInstance) {
  var self = this;
  configInstance.useLogger = function (logger) { self.useLogger(logger); };
};

Configurator.prototype.useLogger = function Configurator$useLogger(logger) {
  assert.ok(logger, 'logger must be an object or function');

  if (typeof(logger) === 'function') {
    this._logger = logger();
  }
  else {
    this._logger = logger;
  }
};

Configurator.prototype.createBroker = function Configurator$createBroker(serviceDomainName, appName, connectionInfo /*, configurator */) {
  return new Broker(serviceDomainName, appName, connectionInfo, this._logger);
};

Configurator.prototype.createPublisher = function Configurator$createPublisher(broker, configurator) {
  var params = this._getParams(PublisherConfigurator, configurator);
  return new Publisher(broker, params.envelope, params.pipeline, params.routeName, params.routePattern, this._logger);
};

Configurator.prototype.createConsumer = function Configurator$createConsumer(broker, configurator) {
  var params = this._getParams(ConsumerConfigurator, configurator);
  return new Consumer(broker, params.envelope, params.pipeline, params.routeName, params.routePattern, this._logger);
};

Configurator.prototype.createSubscriber = function Configurator$createSubscriber(broker, configurator) {
  var params;
  if (typeof(broker) === 'function') { //assume it's a configurator function that uses a custom consumer
    configurator = broker;
    broker = null;
  }
  params = this._getParams(SubscriberConfigurator, configurator);
  if (!params.consumer) {
    params.consumer = new Consumer(broker, params.envelope, params.pipeline, params.routeName, params.routePattern, this._logger);
  }
  return new Subscriber(params.consumer, params.eventDispatcher, this._logger);
};

Configurator.prototype.createBinder = function Configurator$createBinder(connectionInfo, configurator) {
  return Binder(connectionInfo, this._logger);
};
module.exports = Configurator;
