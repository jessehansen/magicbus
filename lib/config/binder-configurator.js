'use strict';

var assert = require('assert-plus');
var Binder = require('../Binder');

module.exports = BinderConfigurator;
/**
 * Binder Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
function BinderConfigurator(connectionInfo, configurator){
  assert.object(connectionInfo, 'connectionInfo');

  this._connectionInfo = connectionInfo;
  this._configurator = configurator;

  this._amqpFactory = function(){
    return require('amqplib');
  };
}

/**
 * Overrides the default amqplib implementation
 */
BinderConfigurator.prototype.useCustomAmqpLib = function BinderConfigurator$useCustomAmqpLib(amqp){
  if (typeof(amqp) !== 'function'){
    this._amqpFactory = function(){ return amqp; };
  }
  else {
    this._amqpFactory = amqp;
  }
};

BinderConfigurator.prototype.createBinder = function BinderConfigurator$createBinder(){
  if (this._configurator) {
    this._configurator(this);
  }
  return new Binder(this._amqpFactory(), this._connectionInfo);
};

/**
 * Message consumption callback
 * @callback binderConfigFunction
 * @param {BinderConfigurator} config - configurator instance
 */
