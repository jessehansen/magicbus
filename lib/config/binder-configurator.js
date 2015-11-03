'use strict';

var cutil = require('./configurator-util');

module.exports = BinderConfigurator;
/**
 * Binder Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
function BinderConfigurator(baseConfig){
  this._amqpFactory = function(){
    return require('amqplib');
  };

  baseConfig.extend(this);
}

/**
 * Overrides the default amqplib implementation
 */
BinderConfigurator.prototype.useCustomAmqpLib = function BinderConfigurator$useCustomAmqpLib(amqp){
  cutil.assertFactoryParam(amqp, 'amqp');
  this._amqpFactory = cutil.createFactoryFunction(amqp);
};

BinderConfigurator.prototype.getParams = function BinderConfigurator$getParams(){
  return {
    amqp: this._amqpFactory()
  };
};

/**
 * Message consumption callback
 * @callback binderConfigFunction
 * @param {BinderConfigurator} config - configurator instance
 */
