'use strict';

module.exports = {
  rabbit: {
    server: process.env.RABBITMQ_HOST || 'localhost',
    user: 'guest',
    pass: 'guest'
  },
  rabbitString: `amqp://guest:guest@${process.env.RABBITMQ_HOST || 'localhost'}/`
};
