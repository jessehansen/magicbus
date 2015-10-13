'use strict';

var assert = require('assert-plus');
var util = require('util');
var BasicEnvelope = require('./lib/basic-envelope.js');
var JsonSerializer = require('./lib/json-serializer.js');

module.exports = {
  Broker: require('./lib/broker.js'),
  Publisher: Publisher,
  Subscriber: Subscriber,
  Sender: Sender,
  Receiver: Receiver
};

function Producer(broker, options) {
  assert.object(broker, 'broker');
  assert.optionalObject(options, 'options');

  if (options) {
    assert.optionalString(options.routingKeyPrefix, 'options.routingKeyPrefix');
    assert.optionalObject(options.envelope, 'options.envelope');
  }

  var routingKeyPrefix = null;
  if (options && options.routingKeyPrefix) {
    routingKeyPrefix = options.routingKeyPrefix;
  }

  var envelope = new BasicEnvelope();
  if (options && options.envelope) {
    envelope = options.envelope;
    console.log('Using custom envelope.');
  }

  this._broker = broker;
  this._defaultRoutingKeyPrefix = routingKeyPrefix;
  this._envelope = envelope;
}

Object.defineProperties(Producer.prototype, {
  _getMessage: {
    value: function(data, kind) {
      return this._envelope.getMessage(data, kind);
    },
    enumerable: false
  },

  _executeMiddleware: {
    value: function(msg) {
      var pipeline = new ProducerMiddlewarePipeline();
      pipeline.execute(msg);
    },
    enumerable: false
  },

  _getRouteName: {
    value: function(options) {
      if (options && options.routeName) {
        return options.routeName;
      }

      return this._defaultRouteName;
    },
    enumerable: false
  },

  _getRoutingKey: {
    value: function(options, eventName) {
      var routingKeyPrefix = this._defaultRoutingKeyPrefix;

      if (options && options.routingKeyPrefix) {
        routingKeyPrefix = options.routingKeyPrefix;
      }

      return routingKeyPrefix ? routingKeyPrefix + '.' + eventName : eventName;
    },
    enumerable: false
  },

  _getSerializedContent: {
    value: function(payload) {
      var serializer = new JsonSerializer();
      return serializer.serialize(payload);
    },
    enumerable: false
  },

  _getPublishOptions: {
    value: function(msg) {
      //Should copy all of msg.properties and set some defaults
      return {
        persistent: true,
        type: msg.properties.type
      };
    },
    enumerable: false
  }
});

function Publisher(broker, options) {
  Producer.call(this, broker, options);

  var routeName = 'publish';

  if (options && options.routeName) {
    routeName = options.routeName;
  }

  this._defaultRouteName = routeName;
}
util.inherits(Publisher, Producer);

Object.defineProperties(Publisher.prototype, {
  publish: {
    value: function(eventName, data, options) {
      assert.string(eventName);
      assert.optionalObject(data);
      assert.optionalObject(options, 'options');
      if (options) {
        assert.optionalString(options.routingKeyPrefix, 'options.routingKeyPrefix');
        assert.optionalString(options.routeName, 'options.routeName');
      }

      var msg = this._getMessage(data, eventName);
      this._executeMiddleware(msg);

      var routeName = this._getRouteName(options);
      var routingKey = this._getRoutingKey(options, eventName);
      var content = this._getSerializedContent(msg.payload);
      var publishOptions = this._getPublishOptions(msg);
      this._broker.publish(routeName, routingKey, content, publishOptions);
    },
    enumerable: true
  }
});

function Consumer(broker, options) {
  assert.object(broker, 'broker');
  assert.optionalObject(options, 'options');

  if (options) {
    assert.optionalObject(options.envelope, 'options.envelope');
  }

  var envelope = new BasicEnvelope();
  if (options && options.envelope) {
    envelope = options.envelope;
  }

  this._broker = broker;
  this._envelope = envelope;
}

Object.defineProperties(Consumer.prototype, {
  _getRouteName: {
    value: function(options) {
      if (options && options.routeName) {
        return options.routeName;
      }

      return this._defaultRouteName;
    },
    enumerable: false
  },

  _getDeserializedPayload: {
    value: function(originalMessage) {
      var serializer = new JsonSerializer();
      return serializer.deserialize(originalMessage.content);
    },
    enumerable: false
  },

  _executeMiddleware: {
    value: function(msg) {
      var pipeline = new ConsumerMiddlewarePipeline();
      pipeline.execute(msg);
    },
    enumerable: false
  },

  _getData: {
    value: function(msg) {
      return this._envelope.getData(msg);
    },
    enumerable: false
  },

  _getMessageTypes: {
    value: function(msg) {
      return this._envelope.getMessageTypes(msg);
    },
    enumerable: false
  }
});

function Subscriber(broker, options) {
  Consumer.call(this, broker);

  assert.optionalObject(options, 'options');

  if (options) {
    assert.optionalString(options.routeName, 'options.routeName');
  }

  var routeName = 'subscribe';
  if (options && options.routeName) {
    routeName = options.routeName;
  }

  this._defaultRouteName = routeName;

  this._handlers = {};
}
util.inherits(Subscriber, Consumer);

Object.defineProperties(Subscriber.prototype, {
  on: {
    value: function(eventName, handler) {
      this._handlers[eventName] = handler;
    },
    enumerable: true
  },

  startSubscription: {
    value: function(options) {
      assert.optionalObject(options, 'options');

      if (options) {
        assert.optionalString(options.routeName, 'options.routeName');
      }

      var routeName = this._getRouteName(options);

      this._broker.consume(routeName, this._consumeCallback.bind(this));
    },
    enumerable: true
  },

  _consumeCallback: {
    value: function(originalMessage) {
      //Assume all the messages coming from the queue have the same
      //serialization, all the middleware can process all the messages, and
      //they all use the same envelope. Use different queues (different routeName)
      //to setup subscribers for messages that need different handling.

      var msg = {
        properties: originalMessage.properties, //Should be a deep copy
        payload: this._getDeserializedPayload(originalMessage)
      };

      this._executeMiddleware(msg);
      var data = this._getData(msg);
      var messageTypes = this._getMessageTypes(msg);
      var handlerMatches = this._getHandlerMatches(messageTypes);

      if (handlerMatches.length > 1) {
        //Need to do some unhandled action here. This is an unrecoverable error so don't retry.
        throw new Error('Cannot have multiple handlers for a message. If you need to do multiple things with a message, put it on multiple queues and consumer it once per queue.');
      }

      if (handlerMatches.length === 1) {
        var match = handlerMatches[0];

        //Need a way to support async handlers
        match.handler(match.messageType, data, msg.properties.authContext);

        //Gonna have the wrong route name here. Is it important to ack on the same channel that we consumed from?
        this._broker.ack(this._getRouteName(), originalMessage);
      } else {
        //Need some unhandled action here. Wascally allows you to configure nack/reject/custom callback.
      }
    },
    enumerable: false
  },

  _getHandlerMatches: {
    value: function(messageTypes) {
      //Simple exact match for now

      var result = [];

      for (var i = 0; i < messageTypes.length; i++) {
        var messageType = messageTypes[i];
        if (this._handlers[messageType]) {
          result.push({
            messageType: messageType,
            handler: this._handlers[messageType]
          });
        }
      }

      return result;
    },
    enumerable: false
  }
});

function Sender(broker, options) {
  Producer.call(this, broker, options);

  var routeName = 'send';

  if (options && options.routeName) {
    routeName = options.routeName;
  }

  this._defaultRouteName = routeName;
}
util.inherits(Sender, Producer);

Object.defineProperties(Sender.prototype, {
  send: {
    value: function(message, messageType, options) {
      assert.object(message);
      assert.optionalString(messageType);
      assert.optionalObject(options, 'options');
      if (options) {
        assert.optionalString(options.routingKeyPrefix, 'options.routingKeyPrefix');
        assert.optionalString(options.routeName, 'options.routeName');
      }

      var msg = this._getMessage(message, messageType);
      this._executeMiddleware(msg);

      var routeName = this._getRouteName(options);
      var routingKey = this._getRoutingKey(options, messageType);
      var content = this._getSerializedContent(msg.payload);
      var publishOptions = this._getPublishOptions(msg);
      this._broker.publish(routeName, routingKey, content, publishOptions);
    }
  }
});

function Receiver(broker, options) {
  Consumer.call(this, broker, options);

  assert.optionalObject(options, 'options');

  if (options) {
    assert.optionalString(options.routeName, 'options.routeName');
  }

  var routeName = 'receive';
  if (options && options.routeName) {
    routeName = options.routeName;
  }

  this._defaultRouteName = routeName;
}
util.inherits(Receiver, Consumer);

Object.defineProperties(Receiver.prototype, {
  startReceiving: {
    value: function(handler, options) {
      assert.func(handler);
      assert.optionalObject(options, 'options');

      if (options) {
        assert.optionalString(options.routeName, 'options.routeName');
      }

      this._handler = handler;
      var routeName = this._getRouteName(options);

      this._broker.consume(routeName, this._consumeCallback.bind(this));
    },
    enumerable: true
  },

  _consumeCallback: {
    value: function(originalMessage) {
      //Assume all the messages coming from the queue have the same
      //serialization, all the middleware can process all the messages, and
      //they all use the same envelope. Use different queues (different routeName)
      //to setup subscribers for messages that need different handling.

      var msg = {
        properties: originalMessage.properties, //Should be a deep copy
        payload: this._getDeserializedPayload(originalMessage)
      };

      this._executeMiddleware(msg);
      var data = this._getData(msg);
      var messageTypes = this._getMessageTypes(msg);

      //I don't think you can get here without a handler
      this._handler(data, messageTypes, msg.properties.authContext);

      //Gonna have the wrong route name here. Is it important to ack on the same channel that we consumed from?
      this._broker.ack(this._getRouteName(), originalMessage);
    },
    enumerable: false
  }
});

function ProducerMiddlewarePipeline() {
  this.execute = function(msg) {
    //Placeholder
  };
}

function ConsumerMiddlewarePipeline() {
  this.execute = function(msg) {
    //Placeholder
  };
}
