'use strict';

var ConsumerPipeline = require('../../lib/middleware').ConsumerPipeline;

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var expect = chai.expect;
var assert = chai.assert;

chai.use(chaiAsPromised);

function simpleMiddleware(message, actions){
  message.properties.headers.push('first: true');
  actions.next();
}

describe('ConsumerPipeline', function() {
  var consumerPipeline;
  var message;

  beforeEach(function() {
    consumerPipeline = new ConsumerPipeline();
    message = {
      properties: {
        headers:[]
      },
      payload:'data'
    };
  });

  describe('#execute', function(){
    var funcs = ['ack', 'nack', 'reject'];
    var i, fn;
    for (i = 0; i < funcs.length; i++){
      fn = funcs[i];
      /* eslint no-loop-func: 1 */
      it('should not call successive functions when middleware calls ' + fn, function (){
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
        var emitted;
        consumerPipeline = new ConsumerPipeline();
        consumerPipeline.use(function(msg, actions){
          actions[fn]({});
        });

        emitted = 0;

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
