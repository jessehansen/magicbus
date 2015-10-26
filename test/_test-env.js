'use strict';

module.exports = {
  rabbit: {
    host: process.env.RABBITMQ_HOST || 'localhost',
    vhost: '/',
    user: 'guest',
    pass: 'guest'
  }
};
