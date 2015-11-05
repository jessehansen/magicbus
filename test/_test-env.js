'use strict';

module.exports = {
  rabbit: {
    host: process.env.RABBITMQ_HOST || 'localhost',
    vhost: 'testing',
    user: 'guest2',
    password: 'guest2'
  }
};
