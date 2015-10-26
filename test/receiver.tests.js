'use strict';

var Receiver = require('../lib/receiver.js');

var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

var sinon = require('sinon');
var sinonChai = require('sinon-chai');
chai.use(sinonChai);

var BasicEnvelope = require('../lib/basic-envelope.js');
var Promise = require('bluebird');

var WorkerRoutePattern = require('../lib/route-patterns/worker-route-pattern.js');

describe('Receiver', function() {
  var mockBroker;

  var eventName;
  var fakeMessage;

  beforeEach(function() {
    //The fake message needs to be real enough to thread the needle through the
    //envelope, serialization, and dispatch parts of the pipeline
    eventName = 'my-event';
    fakeMessage = {
      properties: {
        type: eventName
      },
      content: new Buffer(JSON.stringify('the payload'))
    };
    mockBroker = {
      registerRoute: function( /* name, pattern */ ) {},
      consume: function(routeName, callback /* , options */ ) {
        this._routeName = routeName;
        this._consumer = callback;
      },
      emulateConsumption: function() {
        var self = this;
        return new Promise(function(resolve) {
          self.ack = function(routeName, message) {
            message.__routeName = routeName;
            message.__resolution = 'ack';
            resolve();
          };
          self.nack = function(routeName, message, allUpTo, requeue) {
            message.__routeName = routeName;
            if (requeue)
              message.__resolution = 'nack';
            else
              message.__resolution = 'reject';

            if (allUpTo)
              message.__resolution += '-allUpTo';

            resolve();
          };

          process.nextTick(function() {
            self._consumer(fakeMessage);
          });
        });
      }
    };
  });

  describe('#ctor', function() {

    describe('default construction', function() {
      var receiver;

      beforeEach(function() {
        receiver = new Receiver(mockBroker);
      });

      it('should use receive as the route name', function() {
        expect(receiver._routeName).to.eq('receive');
      });

      it('should use the worker route pattern', function() {
        expect(receiver._routePattern instanceof WorkerRoutePattern).to.eq(true);
      });

      it('should use the basic envelope', function() {
        expect(receiver._envelope instanceof BasicEnvelope).to.eq(true);
      });
    });

    describe('construction options', function() {
      it('should use the route name passed in the options', function() {
        var receiver = new Receiver(mockBroker, {
          routeName: 'my-route'
        });

        expect(receiver._routeName).to.eq('my-route');
      });

      it('should use the route pattern passed in the options', function() {
        var pattern = {};
        var receiver = new Receiver(mockBroker, {
          routePattern: pattern
        });

        expect(receiver._routePattern).to.eq(pattern);
      });

      it('should use the envelope passed in the options', function() {
        var envelope = {};
        var receiver = new Receiver(mockBroker, {
          envelope: envelope
        });

        expect(receiver._envelope).to.eq(envelope);
      });
    });

    describe('constructor broker wireup', function() {
      it('should register a route with the broker', function() {
        sinon.spy(mockBroker, 'registerRoute');

        var pattern = {};
        new Receiver(mockBroker, {
          routePattern: pattern
        });
        expect(mockBroker.registerRoute).to.have.been.calledWith('receive', pattern);
      });
    });

    describe('constructor argument checking', function() {
      it('should throw an assertion error given no broker', function() {
        var fn = function() {
          new Receiver();
        };

        expect(fn).to.throw('AssertionError: broker (object) is required');
      });
    });
  });

  describe('#startReceiving', function() {
    var receiver;

    beforeEach(function() {
      receiver = new Receiver(mockBroker);
    });

    describe('acknowledging messages based on handler results', function() {

      it('should ack the message given a synchronous handler that does not throw', function() {
        var handler = function( /* handlerData, messageTypes, message */ ) {
          //Not throwing an exception here
        };

        receiver.startReceiving(handler);
        return mockBroker.emulateConsumption()
          .then(function() {
            expect(fakeMessage.__resolution).to.equal('ack');
          });
      });

      it('should reject the message given a synchronous handler that throws', function() {
        var handler = function( /* handlerData, messageTypes, message */ ) {
          throw new Error('Aw, snap!');
        };

        receiver.startReceiving(handler);
        return mockBroker.emulateConsumption()
          .then(function() {
            expect(fakeMessage.__resolution).to.equal('reject');
          });
      });

      it('should ack the message after the handler has completed given an asynchronous handler that resolves successfully', function() {
        var handlerCompleted = false;
        var handler = function( /* handlerData, messageTypes, message */ ) {
          return new Promise(function(resolve) {
            process.nextTick(function() {
              handlerCompleted = true;
              resolve();
            });
          });
        };

        receiver.startReceiving(handler);
        return mockBroker.emulateConsumption()
          .then(function() {
            expect(fakeMessage.__resolution).to.equal('ack');
            expect(handlerCompleted).to.equal(true);
          });
      });

      it('should reject the message after the handler has completed given an asynchronous handler that rejects/resolves with an error', function() {
        var handlerCompleted = false;
        var handler = function( /* handlerData, messageTypes, message */ ) {
          return new Promise(function(resolve, reject) {
            process.nextTick(function() {
              handlerCompleted = true;
              reject(new Error('Aw, snap!'));
            });
          });
        };

        receiver.startReceiving(handler);
        return mockBroker.emulateConsumption()
          .then(function() {
            expect(fakeMessage.__resolution).to.equal('reject');
            expect(handlerCompleted).to.equal(true);
          });
      });

      describe('using middleware', function() {
        var handlerCompleted;
        var handlerPayload;

        beforeEach(function() {
          handlerCompleted = false;
          handlerPayload = null;
        });

        function handler(handlerData /*, messageTypes, message */ ) {
          handlerCompleted = true;
          handlerPayload = handlerData;
        }

        function ack(message, actions) {
          actions.ack();
        }

        function nack(message, actions) {
          actions.nack();
        }

        function reject(message, actions) {
          actions.reject();
        }

        function modify(message, actions) {
          message.payload += ' that is new';
          actions.next();
        }

        it('should call middleware when provided', function() {
          receiver.use(modify);
          receiver.startReceiving(handler);
          return mockBroker.emulateConsumption()
            .then(function() {
              expect(fakeMessage.__resolution).to.equal('ack');
              expect(handlerPayload).to.equal('the payload that is new');
              expect(handlerCompleted).to.equal(true);
            });
        });

        it('should ack when middleware calls ack', function() {
          receiver.use(ack);
          receiver.startReceiving(handler);
          return mockBroker.emulateConsumption()
            .then(function() {
              expect(fakeMessage.__resolution).to.equal('ack');
              expect(handlerCompleted).to.equal(false);
            });

        });

        it('should nack when middleware calls nack', function() {
          receiver.use(nack);
          receiver.startReceiving(handler);
          return mockBroker.emulateConsumption()
            .then(function() {
              expect(fakeMessage.__resolution).to.equal('nack');
              expect(handlerCompleted).to.equal(false);
            });

        });

        it('should reject when middleware calls reject', function() {
          receiver.use(reject);
          receiver.startReceiving(handler);
          return mockBroker.emulateConsumption()
            .then(function() {
              expect(fakeMessage.__resolution).to.equal('reject');
              expect(handlerCompleted).to.equal(false);
            });

        });
      });
    });
  });
});
