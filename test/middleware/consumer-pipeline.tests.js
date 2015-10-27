'use strict';

var ConsumerPipeline = require('../../lib/middleware').ConsumerPipeline;

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
var expect = chai.expect;
var assert = chai.assert;

function simpleMiddleware(message, actions){
  message.properties.headers.push('first: true');
  actions.next();
}

describe('ConsumerPipeline', function() {
  var consumerPipeline;
  var message;

  beforeEach(function() {
    consumerPipeline = new ConsumerPipeline();
    message = {properties: {headers:[]}, payload:'data'};
  });

  describe('#execute', function(){
    var funcs = ['ack', 'nack', 'reject'];
    for (var i = 0; i < funcs.length; i++){
      var fn = funcs[i];
      it('should not call successive functions when middleware calls ' + fn, function(){
        consumerPipeline = new ConsumerPipeline();
        consumerPipeline.use(function(msg, actions){
          actions[fn]({});
        });
        consumerPipeline.use(simpleMiddleware);

        return consumerPipeline.prepare()(message).then(function(){
          assert.fail('expected promise to fail, but it succeeded');
        }).catch(function(){
          expect(message.properties.headers.length).to.equal(0);
        });
      });
      it('should emit event when middleware calls ' + fn, function(){
        consumerPipeline = new ConsumerPipeline();
        consumerPipeline.use(function(msg, actions){
          actions[fn]({});
        });

        var emitted = 0;

        return consumerPipeline.prepare(function(eventSink){
          eventSink.on(fn, function(){
            emitted++;
          });
        })(message).then(function(){
          assert.fail('expected promise to fail, but it succeeded');
        }).catch(function(){
          expect(emitted).to.equal(1);
        });
      });
    }
  });
});
