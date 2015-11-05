'use strict';

var Logger = require('../lib/logger');
var _ = require('lodash');

var chai = require('chai');
var expect = chai.expect;

describe('Logger', function(){
  var logger;
  var callCount;
  var logParam;
  var kindEventParam;
  beforeEach(function(){
    logger = new Logger();
    callCount = 0;
  });

  function watch(kind) {
    logger.on('log', function(log){
      callCount++;
      logParam = log;
    });
    logger.on('log:' + kind, function(message){
      callCount++;
      kindEventParam = message;
    });
  }

  function expectCallsToHaveBeenMadeFor(kind, message, err) {
    expect(callCount).to.eql(2);

    expect(logParam.kind).to.eql(kind);
    expect(logParam.message).to.eql(message);
    expect(logParam.err).to.eql(err);

    expect(kindEventParam).to.eql(message);
  }

  describe('#log', function(){

    it('should emit two events', function(done){
      watch('info');

      logger.log('info', 'message');

      process.nextTick(function(){
        expectCallsToHaveBeenMadeFor('info', 'message');
        done();
      });
    });
  });

  _.each(['debug', 'info', 'warn', 'error'], function(kind){
    describe('#' + kind, function(){
      it('should emit two events', function(done){
        watch(kind);

        var err = new Error('hi');

        logger.log(kind, 'message', err);

        process.nextTick(function(){
          expectCallsToHaveBeenMadeFor(kind, 'message', err);
          done();
        });
      });
    });
  });
});
