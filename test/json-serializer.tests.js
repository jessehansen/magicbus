'use strict';

var JsonSerializer = require('../lib/json-serializer.js');

var chai = require('chai');
var expect = chai.expect;

describe('JsonSerializer', function() {
  var serializer;

  beforeEach(function() {
    serializer = new JsonSerializer();
  });

  describe('serialize', function() {
    it('should return a buffer containing the stringified payload', function() {
      var payload = {
        my: 'data'
      };

      var actual = serializer.serialize(payload);

      expect(Buffer.isBuffer(actual)).to.eq(true);
      expect(actual.toString()).to.eq(JSON.stringify(payload));
    });

    it('should return null given no payload', function() {
      var actual = serializer.serialize(null);

      expect(actual).to.eq(null);
    });
  });

  describe('deserialize', function() {
    it('should return an object given a buffer containing a stringified object', function() {
      var payload = {
        my: 'data'
      };

      var content = new Buffer(JSON.stringify(payload));

      var result = serializer.deserialize(content);

      expect(result).to.eql(payload);
    });

    it('should return a string given a buffer containing a string that is not a stringified object', function() {
      var payload = 'ok';

      var content = new Buffer(JSON.stringify(payload));

      var result = serializer.deserialize(content);

      expect(result).to.eq('ok');
    });

    it('should return an integer given a buffer containing an integer', function() {
      var payload = 123;

      var content = new Buffer(JSON.stringify(payload));

      var result = serializer.deserialize(content);

      expect(result).to.eq(123);
    });

    it('should throw an assertion error given it is not passed a buffer', function() {
      var fn = function() {
        serializer.deserialize();
      };

      expect(fn).to.throw('AssertionError: content (Buffer) is required');
    });
  });
});