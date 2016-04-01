'use strict';
if (process.env.LOG_TESTS) {
  const magicbus = require('../');
  const Loggins = require('@leisurelink/skinny-loggins');
  let settings = {
    level: 'silly',
    transports: {
      Console: {
        level: 'silly'
      }
    }
  };
  let logFactory = Loggins(settings);
  logFactory.consumeFrom(magicbus);
}
