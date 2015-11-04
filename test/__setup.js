'use strict';

if (process.env.LOG_TESTS) {
  require('../lib').logSink.on('log', function(log) {
    console.log(JSON.stringify(log));
  });
}
