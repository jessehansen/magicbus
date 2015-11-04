'use strict';
/*eslint no-console: 0*/

if (process.env.LOG_TESTS) {
  require('../lib').logSink.on('log', function(log) {
    console.log(JSON.stringify(log));
  });
}
