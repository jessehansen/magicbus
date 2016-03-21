'use strict';

module.exports = {
  rabbit: {
    server: process.env.RABBITMQ_HOST || 'localhost',
    user: 'guest',
    pass: 'guest',
    noBatch: true
  }
};
