'use strict';

var cutil = require('./configurator-util');

module.exports = BrokerConfigurator;
/**
 * Broker Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
function BrokerConfigurator(baseConfig){
  this._amqpFactory = function(){
    return require('amqplib');
  };

  baseConfig.extend(this);
}

/**
 * Overrides the default amqplib implementation
 */
BrokerConfigurator.prototype.useCustomAmqpLib = function BrokerConfigurator$useCustomAmqpLib(amqp){
  cutil.assertObjectOrFunction(amqp, 'amqp');
  this._amqpFactory = cutil.createFactoryFunction(amqp);
};

BrokerConfigurator.prototype.getParams = function BrokerConfigurator$getParams(){
  return {
    amqp: this._amqpFactory()
  };
};

/**
 * Message consumption callback
 * @callback brokerConfigFunction
 * @param {BrokerConfigurator} config - configurator instance
 */
