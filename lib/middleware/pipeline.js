const { noOp } = require("../util");

/**
 * Represents a pipeline of middleware to be executed for a message
 * @param {Function} actionFactory - factory function that returns an Actions instance
 * @param {Array} pipe - array of middleware to be executed
 * @returns {Object} a module with clone, use, and prepare functions
 */
const pipelineFactory = (actionFactory) => (pipe = []) => {
  let middleware = pipe.slice();
  let logger;

  let module = {
    /** Clone the middleware pipeline */
    clone: () => pipelineFactory(actionFactory)(middleware),
    /** Use a segment */
    use: (segment) => {
      middleware.push(segment);
      return module;
    },
    /** Pass this logger to middleware functions */
    useLogger: (theLogger) => {
      logger = theLogger;
      return module;
    },
    /**
     * Prepare pipeline for execution, with an optional head middleware
     * @param {Function} head - the function to execute at the beginning of the pipeline
     * @returns {Function} a function to execute the middleware pipeline
     */
    prepare: (head = noOp) => {
      let pipe = middleware.slice();
      let actions = actionFactory();
      head(actions);

      return (message, options) =>
        new Promise((resolve, reject) => {
          function executeSegment() {
            let segment;
            if (pipe.length > 0) {
              segment = pipe.shift();
              segment(message, actions, logger, options);
            } else {
              resolve();
            }
          }

          actions.on("error", reject);
          actions.on("next", executeSegment);
          actions.on("finished", reject);

          executeSegment();
        });
    },
  };

  return module;
};

module.exports = pipelineFactory;
