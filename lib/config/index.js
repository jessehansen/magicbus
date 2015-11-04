'use strict';

module.exports = Configurator;

var BrokerConfigurator = require('./broker-configurator');
var Broker = require('../broker');

var PublisherConfigurator = require('./publisher-configurator');
var Publisher = require('../publisher');

var ConsumerConfigurator = require('./consumer-configurator');
var Consumer = require('../consumer');

var SubscriberConfigurator = require('./subscriber-configurator');
var Subscriber = require('../subscriber');

var BinderConfigurator = require('./binder-configurator');
var Binder = require('../binder');

function Configurator() {
  //TODO: accept/instantiate default logger
}

Configurator.prototype._getParams = function Configurator$_getParams(configClass, configurator) {
  var config = new configClass(this);
  if (configurator) {
    configurator(config);
  }
  return config.getParams();
};

Configurator.prototype.extend = function Configurator$extend(/* configInstance */) {
  //TODO: add useLogger function to configInstance
};

Configurator.prototype.createBroker = function Configurator$createBroker(serviceDomainName, appName, connectionInfo, configurator) {
  var params = this._getParams(BrokerConfigurator, configurator);
  return new Broker(params.amqp, serviceDomainName, appName, connectionInfo);
};

Configurator.prototype.createPublisher = function Configurator$createPublisher(broker, configurator) {
  var params = this._getParams(PublisherConfigurator, configurator);
  return new Publisher(broker, params.envelope, params.pipeline, params.routeName, params.routePattern);
};

Configurator.prototype.createConsumer = function Configurator$createConsumer(broker, configurator) {
  var params = this._getParams(ConsumerConfigurator, configurator);
  return new Consumer(broker, params.envelope, params.pipeline, params.routeName, params.routePattern);
};

Configurator.prototype.createSubscriber = function Configurator$createSubscriber(broker, configurator) {
  if (typeof(broker) === 'function') { //assume it's a configurator function that uses a custom consumer
    configurator = broker;
    broker = null;
  }
  var params = this._getParams(SubscriberConfigurator, configurator);
  if (!params.consumer) {
    params.consumer = new Consumer(broker, params.envelope, params.pipeline, params.routeName, params.routePattern);
  }
  return new Subscriber(params.consumer, params.eventDispatcher);
};

Configurator.prototype.createBinder = function Configurator$createBinder(connectionInfo, configurator) {
  var params = this._getParams(BinderConfigurator, configurator);
  return new Binder(params.amqp, connectionInfo);
};
