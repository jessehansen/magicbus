var Promise = require('bluebird');

module.exports = function DeferredPromise(){
  var result = {
    promise: new Promise(function(resolve, reject) {
      result.resolve = resolve;
      result.reject = reject;
    })
  };
  return result;
};
