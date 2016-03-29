'use strict';

var assert = require('assert-plus');

module.exports = {
  assertObjectOrFunction: function (item, param){
    if (typeof(item) == 'function'){
      return;
    }
    assert.object(item, param);
  },
  assertStringOrFunction: function (item, param){
    if (typeof(item) == 'function'){
      return;
    }
    assert.string(item, param);
  },
  createFactoryFunction: function (item){
    if (typeof(item) !== 'function') {
      return function() { return item; };
    }
    return item;
  }
};

