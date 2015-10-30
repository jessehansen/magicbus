'use strict'

module.exports = BrokerConfigurator;
/**
 * Broker Config & Factory
 *
 * @public
 * @constructor Should not be called by the user
 */
function BrokerConfigurator(serviceDomainName, appName, connectionInfo, configurator){

}

/**
 * Message consumption callback
 * @callback brokerConfigFunction
 * @param {BrokerConfigurator} config - configurator instance
 */
