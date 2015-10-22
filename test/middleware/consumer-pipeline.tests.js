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
function secondMiddleware(message, actions){
  message.properties.headers.push('second: true');
  actions.next();
}
function errorMiddleware(message, actions) {
  actions.error(new Error('oh crap'));
}

describe('ConsumerPipeline', function() {
  var consumerPipeline;
  var message;

  beforeEach(function() {
    consumerPipeline = new ConsumerPipeline();
    message = {properties: {headers:[]}, payload:'data'};
  });

  describe('#execute', function(){
    it('should eventually fulfill promise', function(done){
      expect(consumerPipeline.prepare()(message)).to.eventually.be.fulfilled.and.notify(done);
    });
    it('should call middleware function once when it is given one', function(done){
      consumerPipeline.use(simpleMiddleware);
      consumerPipeline.prepare()(message).then(function() {
        expect(message.properties.headers.length).to.equal(1);
        expect(message.properties.headers[0]).to.equal('first: true');
        done();
      }, function(){
        assert.fail('expected promise to succeed, but it failed');
        done();
      });
    });
    it('should call middleware functions in succession when given multiple', function(done){
      consumerPipeline.use(simpleMiddleware);
      consumerPipeline.use(secondMiddleware);
      consumerPipeline.prepare()(message).then(function(){
        expect(message.properties.headers.length).to.equal(2);
        expect(message.properties.headers[0]).to.equal('first: true');
        expect(message.properties.headers[1]).to.equal('second: true');
        done();
      }, function(){
        assert.fail('expected promise to succeed, but it failed');
        done();
      });
    });
    it('should reject promise when error occurs', function(done){
      consumerPipeline.use(errorMiddleware);
      expect(consumerPipeline.prepare()(message)).to.eventually.be.rejectedWith('oh crap').and.notify(done);
    });
    it('should not call successive functions when middleware errors', function(done){
      consumerPipeline.use(errorMiddleware);
      consumerPipeline.use(simpleMiddleware);
      consumerPipeline.use(secondMiddleware);
      consumerPipeline.prepare()(message).then(function(){
        assert.fail('expected promise to fail, but it succeeded');
        done();
      }, function(){
        expect(message.properties.headers.length).to.equal(0);
        done();
      });
    });
    var funcs = ['ack', 'nack', 'reject', 'reply'];
    for (var i = 0; i < funcs.length; i++){
      var fn = funcs[i];
      it('should not call successive functions when middleware calls ' + fn, function(done){
        consumerPipeline = new ConsumerPipeline();
        consumerPipeline.use(function(msg, actions){
          actions[fn]({});
        });
        consumerPipeline.use(simpleMiddleware);

        consumerPipeline.prepare()(message).then(function(){
          expect(message.properties.headers.length).to.equal(0);
          done();
        }, function(){
          assert.fail('expected promise to succeed, but it failed');
          done();
        });
      });
      it('should emit event when middleware calls ' + fn, function(done){
        consumerPipeline = new ConsumerPipeline();
        consumerPipeline.use(function(msg, actions){
          actions[fn]({});
        });

        var emitted = 0;

        consumerPipeline.prepare(function(eventSink){
          eventSink.on(fn, function(){
            emitted++;
          });
        })(message).then(function(){
          expect(emitted).to.equal(1);
          done();
        }, function(){
          assert.fail('expected promise to succeed, but it failed');
          done();
        });
      });
    }
  });
});
