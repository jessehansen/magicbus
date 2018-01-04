const assert = require('assert-plus')
const Promise = require('bluebird')

/**
 * Represents a pipeline of middleware to be executed for a message
 * @param {Function} actionFactory - factory function that returns an Actions instance
 * @param {Array} pipe - array of middleware to be executed
 * @returns {Object} a module with clone, use, and prepare functions
 */
function Pipeline (actionFactory, pipe) {
  assert.func(actionFactory, 'actionFactory')
  assert.optionalArrayOfFunc(pipe, 'pipe')

  let middleware = (pipe || []).slice()
  let logger

  let module = {
    /** Clone the middleware pipeline */
    clone: () => Pipeline(actionFactory, middleware),
    /** Use a segment */
    use: (segment) => {
      middleware.push(segment)
      return module
    },
    /** Pass this logger to middleware functions */
    useLogger: (theLogger) => {
      logger = theLogger
      return module
    },
    /**
     * Prepare pipeline for execution, with an optional head middleware
     * @param {Function} head - the function to execute at the beginning of the pipeline
     * @returns {Function} a function to execute the middleware pipeline
     */
    prepare: (head) => {
      assert.optionalFunc(head, 'head')

      let pipe = middleware.slice()
      let actions = actionFactory()
      if (head) {
        head(actions)
      }

      return (message, options) => new Promise((resolve, reject) => {
        function executeSegment () {
          let segment
          if (pipe.length > 0) {
            segment = pipe.shift()
            segment(message, actions, logger, options)
          } else {
            resolve()
          }
        }

        actions.on('error', reject)
        actions.on('next', executeSegment)
        actions.on('finished', reject)

        executeSegment()
      })
    }
  }

  return module
};

Pipeline.withActionFactory = (actionFactory) => function (pipe) {
  return Pipeline(actionFactory, pipe)
}

module.exports = Pipeline
