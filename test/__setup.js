'use strict';
/*eslint no-console: 0*/
var chalk = require('chalk');

var colors = {
  info: chalk.blue,
  warn: chalk.yellow,
  error: chalk.red,
  debug: chalk.grey
};

function padLeft(str, n, pad) {
  return Array(n - String(str).length + 1).join(pad || '0') + str;
}

// function padRight(str, n, pad) {
//   return str + Array(n - String(str).length + 1).join(pad || '0');
// }

if (process.env.LOG_TESTS) {

  function kind(log) {
    var k = padLeft(log.kind, 5, ' ').toUpperCase();
    return colors[log.kind](k);
  }

  function scope(log) {
    var s = padLeft(log.scope || 'magicbus', 15, ' ');
    return chalk.grey(s);
  }

  require('../lib').logSink.on('log', function(log) {
    var e;
    console.log(`${scope(log)} - ${kind(log)}: ${log.message}`);
    if (log.err) {
      e = JSON.stringify(log.err);
      if (e !== '{}'){
        console.log(e);
      }
    }
  });
}
