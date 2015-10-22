'use strict';

var ProducerPipeline = require('../../lib/middleware').ProducerPipeline;

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

describe('ProducerPipeline', function() {
  var producerPipeline;
  var message;

  beforeEach(function() {
    producerPipeline = new ProducerPipeline();
    message = {properties: {headers:[]}, payload:'data'};
  });

  describe('#execute', function(){
    it('should eventually fulfill promise', function(done){
      expect(producerPipeline.prepare()(message)).to.eventually.be.fulfilled.and.notify(done);
    });
    it('should call middleware function once when it is given one', function(done){
      producerPipeline.use(simpleMiddleware);
      producerPipeline.prepare()(message).then(function(){
        expect(message.properties.headers.length).to.equal(1);
        expect(message.properties.headers[0]).to.equal('first: true');
        done();
      }, function(){
        assert.fail('expected promise to succeed, but it failed');
        done();
      });
    });
    it('should call middleware functions in succession when given multiple', function(done){
      producerPipeline.use(simpleMiddleware);
      producerPipeline.use(secondMiddleware);
      producerPipeline.prepare()(message).then(function(){
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
      producerPipeline.use(errorMiddleware);
      expect(producerPipeline.prepare()(message)).to.eventually.be.rejectedWith('oh crap').and.notify(done);
    });
    it('should not call successive functions when middleware errors', function(done){
      producerPipeline.use(errorMiddleware);
      producerPipeline.use(simpleMiddleware);
      producerPipeline.use(secondMiddleware);
      producerPipeline.prepare()(message).then(function(){
        assert.fail('expected promise to fail, but it succeeded');
        done();
      }, function(){
        expect(message.properties.headers.length).to.equal(0);
        done();
      });
    });
    it('should not impact past messages', function(done){
      var msg1 = {properties: {headers:[]}};
      var msg2 = {properties: {headers:[]}};
      producerPipeline.use(simpleMiddleware);
      producerPipeline.prepare()(msg1).then(function(){
        producerPipeline.prepare()(msg2);
      }).then(function(){
        expect(msg1.properties.headers.length).to.equal(1);
        expect(msg2.properties.headers.length).to.equal(1);
        done();
      }, function(){
        assert.fail('expected promise to succeed, but it failed');
        done();
      });
    });
  });
});
