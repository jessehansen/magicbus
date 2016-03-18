'use strict';

module.exports = {
  rabbitConnectionObject: {
    server: process.env.RABBITMQ_HOST || 'localhost',
    user: 'guest',
    pass: 'guest',
    noBatch: true
  }
};
