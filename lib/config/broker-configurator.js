'use strict'

var assert = require('assert-plus');
var Broker = require('../Broker');

module.exports = BrokerConfigurator;
/**
 * Broker Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
function BrokerConfigurator(serviceDomainName, appName, connectionInfo, configurator){
  assert.string(serviceDomainName, 'serviceDomainName');
  assert.string(appName, 'appName');
  assert.object(connectionInfo, 'connectionInfo');
  assert.optionalFunc(configurator, 'configurator');

  this._serviceDomainName = serviceDomainName;
  this._appName = appName;
  this._connectionInfo = connectionInfo;
  this._configurator = configurator;

  this._amqpFactory = function(){
    return require('amqplib');
  }
}

/**
 * Overrides the default amqplib implementation
 */
BrokerConfigurator.prototype.useCustomAmqpLib = function BrokerConfigurator$useCustomAmqpLib(amqp){
  if (typeof(amqp) !== 'function'){
    this._amqpFactory = function(){ return amqp; };
  }
  else {
    this._amqpFactory = amqp;
  }
}

BrokerConfigurator.prototype.createBroker = function BrokerConfigurator$createBroker(){
  if (this._configurator) {
    this._configurator(this);
  }
  return new Broker(this._amqpFactory(), this._serviceDomainName, this._appName, this._connectionInfo);
}

/**
 * Message consumption callback
 * @callback brokerConfigFunction
 * @param {BrokerConfigurator} config - configurator instance
 */
