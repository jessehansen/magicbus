'use strict';

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

module.exports = BrokerConfigurator;
