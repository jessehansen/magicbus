# magicbus

[![CircleCI](https://circleci.com/gh/twindagger/magicbus.svg?style=svg)](https://circleci.com/gh/twindagger/magicbus) [![Coverage Status](https://coveralls.io/repos/github/twindagger/magicbus/badge.svg?branch=master)](https://coveralls.io/github/twindagger/magicbus?branch=master)
[![Dependencies](https://david-dm.org/twindagger/magicbus.svg)]

Helps messages [get on the bus that takes me to you](https://www.youtube.com/watch?v=bl9bvuAV-Ao).

A message bus framework implementing configurable pipelines to prepare messages to be published to and consumed from [RabbitMQ](https://www.rabbitmq.com/). Internally, the primary library for interacting with RabbitMQ is [amqplib](https://github.com/squaremo/amqp.node). Much of the connection code was initially lifed from [wascally](https://github.com/LeanKit-Labs/wascally)

## What Does This Add to amqplib?

* A simple [interface](#user-content-interfaces-exposed-to-domain-services) for application code to use (you'll never have to work directly with a channel)
* Setup local topology following a default messaging pattern
* Pluggable "envelope" formats to be interoperable with other opinionated frameworks
* Middleware pipelines for producers and consumers
* Content serialization/deserialization
* Dispatch of messages to handlers based on message type when consuming multiple message types from a single queue
* Connection management (single connection, re-establishing a lost connection)

## Totally Customizable

While magicbus has opinions baked in for message serialization/envelope generation and exchange/queue topology, they can be easily replaced. This makes it possible, for example, to interoperate with other event bus frameworks on RabbitMQ, for example: [MassTransit](http://masstransit-project.com/).

# Installation

```bash
$ npm install --save magicbus
```

# Usage

Usage is a broad topic due to the number of potential scenarios. A bare-bones pub-sub scenario is described below.

## Publishing App

```javascript
var magicbus = require('magicbus');
var broker = magicbus.createBroker('domain-one', 'my-api', 'amqp://guest:guest@docker.dev/');

var publisher = magicbus.createPublisher(broker);

publisher.publish('publisher-executed', {
  some: 'data'
});
```

## Subscribing App

```javascript
var magicbus = require('magicbus');

var broker = magicbus.createBroker('domain-two', 'my-worker', 'amqp://guest:guest@docker.dev/');

var subscriber = magicbus.createSubscriber(broker);

subscriber.on('publisher-executed', function(eventName, data, rawMessage) {
  console.log('The publisher was executed!');
  console.log(data);
});

subscriber.startSubscription();
```

## Events

The magicbus library will emit the following events (subscribed to via the `on` function).

### log

Example event data:
```js
{
  kind: 'silly|debug|verbose|info|warn|error',
  message: 'message',
  namespace: 'magicbus[.specific namespace]',
  err: new Error('magicbus error')
}
```

### unhandled-error

Fired when a subscriber event handler or consumer handler returns or throws an Error.

Example event data:
```js
{
  data: /* deserialized message payload */,
  messageTypes: /* deserialized message type(s), array */,
  message: /* raw rabbitmq message */,
  error: /* the Error */
}
```

### unhandled-middleware-error

Fired when middleware returns an Error.

Example event data:
```js
{
  message: /* raw rabbitmq message */,
  error: /* the Error */
}
```

### unhandled-event

Fired when a subscriber receives a message that does not have a corresponding handler.

Example event data:
```js
{
  data: /* deserialized message payload */,
  messageTypes: /* deserialized message type(s), array */,
  message: /* raw rabbitmq message */
}
```

## Cross-app Bindings

Since the publisher and subscriber above are in two two separate domains, and it's assumed that one app has no permission on any of the exchanges/queues
in the other app's security domain, the framework does not setup any bindings. You'll need to use a `Binder` to bind the subscriber's queue to the publisher's
exchange for messages to reach the subscriber. Typically this is done by a configuration app with elevated permissions.

# Framework Components

## Broker

* Maintains a single connection to a single RabbitMQ server/vhost
* Maintains channels for each producer/consumer in the app
* Creates local (as opposed to cross-app) exchanges/queues/bindings for producers/consumers
* TODO: Provides delayed retry support for consumers

You should have a single Broker for your entire deployable. That way the same connection is used between all your publishing and consuming routes, which is a RabbitMQ best practice.

## Publisher

Use a Publisher to publish events and send commands through RabbitMQ.

### createPublisher(broker, configurator)

Creates a new instance of `Publisher`.

* `broker` is an instance of the `Broker` class, configured for connection to your desired endpoint
* `configurator` is a function that will be called and allow you to override default implementations of internal components

### #publish(eventName, data, options)

Publish an event.

* `eventName` is a required string
* `data` is an optional parameter of any type
* `options` is an optional collection of publishing options, overriding the options from the constructor

This method is asynchronous and returns a promise.

### #send(message, messageType, options)

Send a command/message.

* `message` is a require parameter of any type
* `messageType` is an optional string
* `options` is an optional collection of publishing options

This method is asynchronous and returns a promise.

## Consumer

Use a Consumer to consume all messages from a RabbitMQ queue. The consumer does not handle dispatching messages by message type so there are only limited scenarios where you want to use a Consumer directly. You probably want to use a [Subscriber](#user-content-subscriber).

### createConsumer(broker, configurator)

Creates a new instance of `Consumer`.

* `broker` is an instance of the `Broker` class, configured for connection to your desired endpoint
* `configurator` is a function that will be called and allow you to override default implementations of internal components

### #startConsuming(handler, options)

Register a handler for messages returned from a queue.

* `handler` is a required function with the signature described below
* `options` is an optional collection of consumption options, overriding the options from the constructor

### Handler Signature

```javascript
consumer.startConsuming((message, messageTypes, rawMessage) => {
  //Do work
});
```

Messages will be acked as long as the handler doesn't throw. If the handler does throw, the message will either be:

* failed and discarded or placed on a failure queue depending on subscriber configuration
* re-queued and retried later

TODO: The type of error determines how the message is treated. Programmer errors will be treated as "unrecoverable" and will not be retried.
Operational errors will be retried. See [this article](https://www.joyent.com/developers/node/design/errors) for a description of the difference.
Need to define our best guess at differentiating the two.

Asynchronous handlers should return a promise. They should reject the promise using the same guidelines that applies for throwing errors from synchronous handlers.

## Subscriber

Use a Subscriber to consume events and commands from RabbitMQ and have those messages dispatched to handlers based on message type.

### createSubscriber(broker, configurator)

Creates a new instance of `Subscriber`.

* `broker` is an instance of the `Broker` class, configured for connection to your desired endpoint
* `configurator` is a function that will be called and allow you to override default implementations of internal components

### #on(eventNames, handler)

Register a handler for an event.

* `eventNames` is a required single string or regex, or an array of strings or regex. To handle all messages, use `/.*/`.
* `handler` is a required function with the signature described below

### Handler Signature

**NOTE** The order of arguments on a subscriber handler is different from the order of arguments on a consumer handler.

```javascript
subscriber.on('created', (event, data, rawMessage) => {
  //Do Work
});
```

Message acknowledgement is the same as with a Consumer handler. Asynchronous handlers should return a Promise. If multiple handlers are matched for a given event, only the first handler (by order of registration) is executed.

### #startSubscription(options)

Starts consuming from the queue.

* `options` is an optional collection of consumption options, overriding the options from the constructor

Don't call this until you've finished registering your handlers or you may end up with unhandled messages that you would have handled if your handler registration were complete.

This method is asynchronous and returns a promise.

## Binder

Link a publishing route to a consuming route by binding an exchange to a queue. Typically useful in configuration apps, integration tests, and application self-messaging.

### createBinder(connectionInfo, configurator)

Creates a new instance of `Binder` with the specified connection info. Connection info can be any url that amqplib's connect method supports.

### #bind(publishingRoute, consumingRoute, options)

Configures a binding from the publishing route to the consuming route.

# Extension Points

Magic bus provides default implementations of all components so you can be up and running quickly. However all the messaging parties also allow you to inject custom implementations of any component used in the message pipeline.

## Envelopes

An "envelope" is responsible for producing an initial message at the beginning of the producer messaging pipeline. In the consumer pipeline, it is responsible for reading values required by the messaging pipeline from wherever it put them when it produced the message.

The initial message must have a payload property which will be serialized into a Buffer to pass as the `content` parameter to the [amqplib publish method](http://www.squaremobius.net/amqp.node/channel_api.html#channel_publish). The `properties` property of the initial message will be used as the `options`
parameter of the publish method so documentation of those options applies.

The default envelope creates messages with the following shape, serialized as JSON:

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

In the producer messaging pipeline, a content serializer is responsible for converting the `payload` property of the message into a Buffer. In the consumer messaging pipeline it is responsible for the reverse: converting the `content` property of the message received by the [amqplib consume callback](http://www.squaremobius.net/amqp.node/channel_api.html#channel_consume) into an appropriate data structure.

The default content serializer uses JSON.

## Middleware

Middleware can be added to any messaging party to manipulate the message produced or consumed. In the producer pipeline, middleware runs after the envelope creates the initial message, and before the payload is serialized.
In the consumer pipeline, middleware runs after the content is deserialized and before the consumed message is sent to any handlers registered by the application. Middleware functions should have the following signature:

```javascript
function MyCoolMiddleware(message, actions) {
  //do something cool
}
// ...
publisher.use(MyCoolMiddleware);
// ...
consumer.use(MyOtherCoolMiddleware);
// ...
subscriber.use(YetAnotherMiddleware);
```

The message parameter will always be a "complete" message, either created by an envelope, or provided to the amqplib consume callback. The actions available are different for producer and consumer middleware.

There is currently no default middleware.

### Producer Middleware

The actions available to producer middleware are:
* `actions.next()` - proceed to the next step.
* `actions.error(err)` - abort publishing with the associated error.

### Consumer Middleware

The actions available to consumer middleware (both subscriber and consumer) are:
* `actions.next()` - proceed to the next step.
* `actions.error(err)` - abort consumption of this message with the associated error.
* `actions.ack()` - acknowledge the message (removing it from the queue) and stop processing.
* `actions.nack()` - abort processing of this message, but leave it in the queue.
* `actions.reject()` - abort processing of this message and remove it from the queue. Results in a NACK. Depending on route pattern and queue setup, may result in a requeue to a failure queue.

## Customizing the Message Pipeline

The main methods of all messaging parties are implemented as template methods so you can override an individual piece of the message pipeline if needed.

## Route Pattern

A route pattern defines the topology pattern for a publisher or consumer. The pattern defines the name of the exchange or queue, along with the types and options associated with it. `magicbus` contains 3 route pattern implementations:

* `ListenerRoutePattern` - creates a durable fanout exchange bound to one exclusive queue per consuming app (queue name is randomized).
* `PublisherRoutePattern` (default for publisher) - creates a durable exchange (optionally, exchange type can be specified) with no bindings
* `WorkerRoutePattern` (default for consumer/subscriber) - creates a consumption queue with a dead-letter-exchange for failed messages, along with an associated failure queue.

# Contributing

## Running Tests

Run all tests with the usual command:

```bash
$ npm test
```

### Setting Up For Integration Tests

You'll need access to a running RabbitMQ server. The easiest way to get rabbit running is with this `docker` command:
```bash
$ docker create --name rabbitmq -p 5672:5672 -p 15672:15672 \
  rabbitmq:management
$ docker start rabbitmq
```

You can also [download](http://www.rabbitmq.com/download.html) and install it locally.

The integration tests will automatically create the necessary exchanges, queues, and bindings.

## Style Guidelines

Prevent git from messing up the line endings on windows: `git config --global core.autocrlf false`

## License

MIT license
