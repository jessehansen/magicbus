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
  baseConfig.extend(this);
}

BrokerConfigurator.prototype.getParams = function BrokerConfigurator$getParams(){
  return {};
};

/**
 * Message consumption callback
 * @callback brokerConfigFunction
 * @param {BrokerConfigurator} config - configurator instance
 */
