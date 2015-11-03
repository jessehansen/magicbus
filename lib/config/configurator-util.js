'use strict';

var assert = require('assert-plus');

module.exports = {
  assertObjectOrFunction: function ConfiguratorUtil$assertObjectOrFunction(item, param){
    if (typeof(item) == 'function'){
      return;
    }
    assert.object(item, param);
  },
  assertStringOrFunction: function ConfiguratorUtil$assertStringOrFunction(item, param){
    if (typeof(item) == 'function'){
      return;
    }
    assert.string(item, param);
  },
  createFactoryFunction: function ConfiguratorUtil$createFactoryFunction(item){
    if (typeof(item) !== 'function') {
      return function() { return item; };
    }
    return item;
  }
};

