const Promise = require('bluebird')

/**
 * Created a promise that can be accessed and resolved/rejected at will
 *
 * @public
 * @returns an object with three properties - promise (Promise), resolve (function), and reject (function)
 */
const deferredPromise = () => {
  let result = {}
  result.promise = new Promise((resolve, reject) => {
    result.resolve = resolve
    result.reject = reject
  })
  return result
}

module.exports = deferredPromise
