'use strict';

var Logger = require('../lib/logger');
var _ = require('lodash');

var chai = require('chai');
var expect = chai.expect;

describe('Logger', function(){
  var logger;
  beforeEach(function(){
    logger = new Logger();
  });

  describe('#log', function(){

    it('should emit two events', function(done){
      var callCount = 0;
      logger.on('log', function(l){
        expect(l.kind).to.eql('info');
        expect(l.message).to.eql('message');
        callCount++;
      });
      logger.on('log:info', function(message){
        expect(message).to.eql('message');
        callCount++;
      });

      logger.log('info', 'message');

      process.nextTick(function(){
        expect(callCount).to.eql(2);
        done();
      });
    });
  });

  _.each(['debug', 'info', 'warn', 'error'], function(kind){
    describe('#' + kind, function(){
      it('should emit two events', function(done){
        var err = new Error('hi');
        var callCount = 0;
        logger.on('log', function(l){
          expect(l.kind).to.eql(kind);
          expect(l.message).to.eql('message');
          expect(l.err).to.eql(err);
          callCount++;
        });
        logger.on('log:' + kind, function(message){
          expect(message).to.eql('message');
          callCount++;
        });

        logger.log(kind, 'message', err);

        process.nextTick(function(){
          expect(callCount).to.eql(2);
          done();
        });
      });
    });
  });
});
