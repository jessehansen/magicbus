'use strict';

var Promise = require('bluebird');

/**
 * Created a promise that can be accessed and resolved/rejected at will
 *
 * @public
 * @returns an object with three properties - promise (Promise), resolve (function), and reject (function)
 */
module.exports = function DeferredPromise(){
  var result = {};
  result.promise = new Promise(function(resolve, reject) {
    result.resolve = resolve;
    result.reject = reject;
  });
  return result;
};
