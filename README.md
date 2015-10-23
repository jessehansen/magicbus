# magicbus

Helps messages [get on the bus that takes me to you](https://www.youtube.com/watch?v=bl9bvuAV-Ao).

A message bus framework implementing configurable pipelines to prepare messages to be
published to and consumed from [RabbitMQ](https://www.rabbitmq.com/). Internally, the primary library for
interacting with RabbitMQ is [amqplib](https://github.com/squaremo/amqp.node).

## What Does This Add to amqplib?

* A simple [interface](#user-content-interfaces-exposed-to-domain-services) for application code to use (you'll never have to work directly with a channel)
* Setup local topology following the LeisureLink [Event Bus Architecture](https://vacationroost.atlassian.net/wiki/display/EN/Event+Bus+Architecture) (cross-app topology/bindings out of scope)
* Pluggable "envelope" formats to be interoperable with other opinionated frameworks
* Middleware pipelines for producers and consumers
* Content serialization/deserialization
* Delayed retry support for consumers
* Dispatch of messages to handlers based on message type when consuming multiple message types from a single queue
* Connection management (single connection, re-establishing a lost connection)

# Installation

```bash
$ npm install @leisurelink/magicbus
```

# Usage

Usage is a broad topic due to the number of potential scenarios. A bare-bones pub-sub scenario is described below.
For more examples, including best practices for usage in LeisureLink's "Blue" system, see the
[messaging-examples](https://github.com/LeisureLink/messaging-examples) repo.

## Publishing App

```javascript
var MagicBus = require('@leisurelink/magicbus');
var Broker = MagicBus.Broker;
var Publisher = MagicBus.Publisher;

var serviceDomainName = 'my-domain';
var appName = 'my-publisher';

var connectionInfo = {
  server: 'localhost',
  vhost: '/',
  user: 'guest',
  pass: 'guest'
};

var broker = new Broker(serviceDomainName, appName, connectionInfo);

var publisher = new Publisher(broker);

publisher.publish('publisher-executed', {
  some: 'data'
});
```

## Subscribing App

```javascript
var MagicBus = require('@leisurelink/magicbus');
var Broker = MagicBus.Broker;
var Subscriber = MagicBus.Subscriber;

var serviceDomainName = 'my-domain';
var appName = 'my-subscriber';

var connectionInfo = {
  server: 'localhost',
  vhost: '/',
  user: 'guest',
  pass: 'guest'
};

var broker = new Broker(serviceDomainName, appName, connectionInfo);

var subscriber = new Subscriber(broker);

subscriber.on('publisher-executed'), function(eventName, data, rawMessage) {
  console.log('The publisher was executed!');
  console.log(data);
});

subscriber.startSubscription();
```

## Cross-app Bindings

Since the publisher and subscriber above are two separate apps, and it's assumed that one app has no permission
on any of the exchanges/queues in the other app's security domain, the framework does not setup any bindings.
You'll need to manually bind the subscriber's queue to the producer's exchange for messages to reach the
subscriber.

# Framework Components

## Broker

* Maintains a single connection to a single RabbitMQ server/vhost
* Maintains channels for each producer/consumer in the app
* Creates local (as opposed to cross-app) exchanges/queues for producers/consumers
* Provides delayed retry support for consumers

**Is 'Broker' the right term for this component?**

## Messaging Parties

Each party is either a producer or consumer of messages. While publisher/subscriber pair is very similar to
the sender/receiver pair, there are small semantic differences.

**Need to put some more thought into these and whether they are worthwhile. Some considerations:**

* Should they create different local topology? Does it matter if the framework doesn't handle cross-app binding?
* Currently the receiver doesn't implement message dispatch by type. Should it? If you want to handle dispatch yourself, you could register a single wildcard handler.

### Producer

#### #publish(eventName, data, options)

Publish an event.

* `eventName` is a required string
* `data` is an optional parameter of any type
* `options` is an optional collection of publishing options

This method is asynchronous and returns a promise.

#### #send(message, messageType, options)

Send a command/message.

* `message` is a require parameter of any type
* `messageType` is an optional string
* `options` is an optional collection of publishing options

This method is asynchronous and returns a promise.

### Consumer

#### #on(eventNames, handler)

Register a handler for an event.

* `eventNames` is a required single string or regex, or an array of strings or regex
* `handler` is a required function with the signature described below

#### Handler Signature

```javascript
function handleFooCreated(eventName, data, rawMessage) {
  //Do work
}
```

Messages will be acked as long as the handler doesn't throw. If the handler does throw, the message will either be:

* failed and discarded or placed on a failure queue depending on subscriber configuration
* re-queued and retried later

The type of error determines how the message is treated. Programmer errors will be treated as "unrecoverable" and will not be retried. Operational errors will be retried. See [this article](https://www.joyent.com/developers/node/design/errors) for a description of the difference. Need to define our best guess at differentiating the two.

Asynchronous handlers should return a promise. They should reject the promise using the same guidelines that applies for throwing errors from synchronous handlers.

#### #startSubscription()

Starts consuming from the queue. Don't call this until you've finished registering your handlers or you may end up with unhandled messages that you would have handled if your handler registration were complete.

This method is asynchronous and returns a promise.

#### #startReceiving(handler)

Receive all messages from the queue through the same handler.

* `handler` is a required function with the signature described below

This method is asynchronous and returns a promise.

#### Handler Signature

The order of arguments of a receiver handler is different from the order of arguments of a subscriber handler.

```javascript
function handle(message, messageTypes, rawMessage) {
  //Do work
}
```

The ack behavior of a receiver handler is the same as for a subscriber handler. Like subscriber handlers, asynchronous handlers should return promises.

# Extension Points

Magic bus provides default implementations of all components so you can be up and running quickly. However all the messaging parties also allow you to inject custom implementations of any component used in the message pipeline.

## Envelopes

An "envelope" is responsible for producing an initial message at the beginning of the producer messaging pipeline. In the consumer pipeline, it is responsible for reading values required by the messaging pipeline from wherever it put them when it produced the message.

The initial message must have a payload property which will be serialized into a Buffer to pass as the `content` parameter to the [amqplib publish method](http://www.squaremobius.net/amqp.node/channel_api.html#channel_publish). The `properties` property of the initial message will be used as the `options`
parameter of the publish method so documentation of those options applies.

The default envelope creates messages with the following shape:

```javascript
{
  properties: {
    contentType: 'application/prs.magicbus+json',
    type: '<the type>'
  },
  payload: <the data>
}
```

### Choosing a Content Type

The content type was chosen based on information from [this standards doc](http://www.w3.org/Protocols/rfc1341/4_Content-Type.html) and [this Wikipedia article](https://en.wikipedia.org/wiki/Media_type). Specifically, our content type is in the "Personal or Vanity Tree" because at this time, MagicBus is a "product[] that [is] not distributed commercially". When building an envelope to interoperate with another system, you probably want your envelope to use the other system's content type.

## Content Serializers

In the producer messaging pipeline, a content serializer is responsible for converting the `payload` property of the message into a Buffer. In the consumer messaging pipeline it is responsible for the reverse: converting
the `content` property of the message received by the [amqplib consume callback](http://www.squaremobius.net/amqp.node/channel_api.html#channel_consume) into an appropriate data structure.

The default content serializer uses JSON.

## Middleware

Middleware can be added to any messaging party to manipulate the message produced or consumed. In the producer pipeline, middleware runs after the envelope creates the initial message, and before the payload is serialized.
In the consumer pipeline, middleware runs after the content is deserialized and before the consumed message is sent to any handlers registered by the application. Middleware functions should have the following signature:

```javascript
function MyCoolMiddleware(message, actions) {
  //do something cool
}
// ...
producer.use(MyCoolMiddleware);
// ...
consumer.use(MyOtherCoolMiddleware);

```

The message parameter will always be a "complete" message, either created by an envelope, or provided to the amqplib consume callback. The actions available are different for producer and consumer middleware.

There is no default middleware. The [messaging-examples](https://github.com/LeisureLink/messaging-examples) repo demonstrates some of the middleware available from other repos.

### Producer Middleware

The actions available to producer middleware (both publisher and sender) are:
* `actions.next()` - proceed to the next step.
* `actions.error(err)` - abort publishing with the associated error.

### Consumer Middleware

The actions available to consumer middleware (both subscriber and receiver) ar:
* `actions.next()` - proceed to the next step.
* `actions.error(err)` - abort consumption of this message with the associated error.
* `actions.ack()` - acknowledge the message (removing it from the queue) and stop processing.
* `actions.nack()` - abort processing of this message, but leave it in the queue.
* `actions.reject()` - abort processing of this message and remove it from the queue. Results in a NACK.

## Customizing the Message Pipeline

The main methods of all messaging parties are implemented as template methods so you can override an individual piece of the message pipeline if needed.

# Contributing

## Running Tests

Run all tests with the usual command:

```bash
$ npm test
```

This will run all tests, including integration tests that require a running RabbitMQ server initialized with test queues and exchanges. To exclude the integration tests (like on a build server without access to RabbitMQ), run:

```bash
$ npm run-script test-ex-integration
```

### Setting Up For Integration Tests

You'll need access to a running RabbitMQ server. You can [download](http://www.rabbitmq.com/download.html) and install it locally for free.

Login to the RabbitMQ management interface and create the exchange and queue the integration tests use.

New Exchange Info:

```
Virtual Host: /
Name:         magicbus.tests.publish
Type:         topic
Durability:   Durable
Auto Delete:  No
Internal:     No
```

New Queue Info:

```
Virtual Host: /
Name:         magicbus.tests.subscribe
Durability:   Durable
Auto Delete:  No
```

After creating the queue, bind it to the exchange:

```
From Exchange: magicbus.tests.publish
Routing Key:   #
```

**NOTE: Running the integration tests will create the exchange and queue, but not the bindings.
So you could save a couple manual steps.**

### Todo

* Optionally batch ack and nack calls (on by default)
* Support event-messenger retry stuff
