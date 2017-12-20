'use strict';
if (process.env.LOG_TESTS) {
  const magicbus = require('../');
  const winston = require('winston');

  const logger = new (winston.Logger)({
    level: 'silly',
    transports: [
      new (winston.transports.Console)()
    ]
  });

  magicbus.on('log', (ev) => {
    if (ev.namespace) {
      if (ev.err) {
        logger.log(ev.kind, `${ev.namespace}:`, ev.message, ev.err);
      } else {
        logger.log(ev.kind, `${ev.namespace}:`, ev.message);
      }
    } else if (ev.err) {
      logger.log(ev.kind, ev.message, ev.err);
    } else {
      logger.log(ev.kind, ev.message);
    }
  });
}
