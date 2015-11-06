'use strict';

module.exports = {
  rabbitConnectionObject: {
    protocol: 'amqp',
    hostname: process.env.RABBITMQ_HOST || 'localhost',
    vhost: '',
    username: 'guest',
    password: 'guest'
  },
  rabbitConnectionString: 'amqp://guest:guest@' + (process.env.RABBITMQ_HOST || 'localhost') + '/'
};
