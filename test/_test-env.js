'use strict';

module.exports = {
  rabbit: {
    protocol: 'amqp',
    hostname: process.env.RABBITMQ_HOST || 'localhost',
    vhost: '/',
    username: 'guest',
    password: 'guest'
  }
};
