const createTopology = require('../lib/topology');
const FakeMachine = require('./_fake-machine');
const Monologue = require('monologue.js');

const Promise = require('bluebird');
const Logger = require('../lib/logger');

const chai = require('chai');
const expect = chai.expect;

const sinon = require('sinon');
const sinonChai = require('sinon-chai');
chai.use(sinonChai);

chai.use(require('chai-as-promised'));

describe('Topology', function() {
  let mockConnection;
  let mockChannel;
  let logger;
  let emitter;

  beforeEach(function() {
    emitter = new Monologue();
    mockConnection = {
      createChannel: () => mockChannel,
      addQueue: () => Promise.resolve(),
      on: (event, handler) => emitter.on(event, handler),
      reset: () => 0
    };
    mockChannel = {
      bindQueue: function(/* target, source, key */) {
        return Promise.resolve();
      },
      bindExchange: function(/* target, source, key */) {
        return Promise.resolve();
      },
      check: () => Promise.resolve(),
      destroy: () => Promise.resolve(),
      assertQueue: () => Promise.resolve(),
      assertExchange: () => Promise.resolve(),
      once: () => 0,
      on: () => 0
    };
    logger = Logger();
  });

  const constructTopology = () => createTopology(mockConnection, logger, FakeMachine, FakeMachine);

  describe('constructor', function() {
    it('should call onReconnect when reconnected', function(){
      let topology = constructTopology();
      sinon.spy(topology, 'onReconnect');

      emitter.emit('reconnected');

      expect(topology.onReconnect).to.have.been.calledWith();
    });
    it('should call check supporting channels', async function() {
      let topology = constructTopology();
      topology.getChannel('control');
      sinon.spy(mockChannel, 'check');

      emitter.emit('reconnected');
      await Promise.delay(1);

      expect(mockChannel.check).to.have.been.calledWith();
    });
    it('should be ok when channel does not support check', function() {
      let topology = constructTopology();
      delete mockChannel.check;
      topology.getChannel('control');

      emitter.emit('reconnected');
    });
    it('should configure bindings upon reconnect', async function(){
      let topology = constructTopology();
      sinon.spy(topology, 'configureBindings');

      await topology.createBinding({
        queue: true,
        source: 'some-exchange',
        target: 'some-queue',
        keys: 'some-key'
      });

      emitter.emit('reconnected');
      await Promise.delay(1);

      expect(topology.configureBindings).to.have.been.calledWith(topology.definitions.bindings);
    });
  });

  describe('configureBindings', function() {
    let topology;

    beforeEach(function() {
      topology = constructTopology();
    });

    it('can be called with no arguments', async function() {
      await topology.configureBindings();
    });

    it('can be called with empty array', async function() {
      await topology.configureBindings([]);
    });

    it('can be called with a single binding', async function() {
      sinon.spy(mockChannel, 'bindQueue');
      await topology.configureBindings({ queue: true, source: 'some-exchange', target: 'some-queue' });
      expect(mockChannel.bindQueue).to.have.been.calledWith('some-queue', 'some-exchange', '');
    });

    it('can be called with an array', async function() {
      sinon.spy(mockChannel, 'bindQueue');
      await topology.configureBindings([
        { queue: true, source: 'some-exchange', target: 'some-queue' },
        { queue: true, source: 'some-exchange', target: 'some-other-queue' }
      ]);
      expect(mockChannel.bindQueue).to.have.been.calledWith('some-queue', 'some-exchange', '');
      expect(mockChannel.bindQueue).to.have.been.calledWith('some-other-queue', 'some-exchange', '');
    });

    it('can be called with an object', async function() {
      sinon.spy(mockChannel, 'bindQueue');
      await topology.configureBindings({
        'some-exchange->some-queue': { queue: true, source: 'some-exchange', target: 'some-queue' },
        'some-exchange->some-other-queue': { queue: true, source: 'some-exchange', target: 'some-other-queue' }
      }, true);
      expect(mockChannel.bindQueue).to.have.been.calledWith('some-queue', 'some-exchange', '');
      expect(mockChannel.bindQueue).to.have.been.calledWith('some-other-queue', 'some-exchange', '');
    });

    it('can infer that binding is to a queue when queue was previously configured', async function() {
      await topology.createQueue({ name:'some-queue' });
      sinon.spy(mockChannel, 'bindQueue');
      await topology.configureBindings({ source: 'some-exchange', target: 'some-queue' });
      expect(mockChannel.bindQueue).to.have.been.calledWith('some-queue', 'some-exchange', '');
    });

    it('can infer that binding is to an exchange when no queue was previously configured', async function() {
      sinon.spy(mockChannel, 'bindExchange');
      await topology.configureBindings({ source: 'some-exchange', target: 'some-other-exchange' });
      expect(mockChannel.bindExchange).to.have.been.calledWith('some-other-exchange', 'some-exchange', '');
    });
  });

  describe('#createBinding', function() {
    let topology;

    beforeEach(function() {
      topology = constructTopology();
    });

    it('should call bindQueue when target is a queue', async function() {
      sinon.spy(mockChannel, 'bindQueue');

      await topology.createBinding({
        queue: true,
        source: 'some-exchange',
        target: 'some-queue'
      });

      expect(mockChannel.bindQueue).to.have.been.calledWith('some-queue', 'some-exchange', '');
    });

    it('should return previous promise when called with same args twice', async function() {
      sinon.spy(mockChannel, 'bindQueue');

      let params = {
        queue: true,
        source: 'some-exchange',
        target: 'some-queue'
      };

      await topology.createBinding(params);
      await topology.createBinding(params);

      expect(mockChannel.bindQueue).to.have.been.calledWith('some-queue', 'some-exchange', '');
      expect(mockChannel.bindQueue).to.have.been.calledOnce;
    });

    it('should call bindExchange when target is an exchange', async function() {
      sinon.spy(mockChannel, 'bindExchange');

      await topology.createBinding({
        queue: false,
        source: 'some-exchange',
        target: 'some-other-exchange'
      });

      expect(mockChannel.bindExchange).to.have.been.calledWith('some-other-exchange', 'some-exchange', '');
    });

    it('should support passing a single routing key', async function() {
      sinon.spy(mockChannel, 'bindQueue');

      await topology.createBinding({
        queue: true,
        source: 'some-exchange',
        target: 'some-queue',
        keys: 'some-key'
      });

      expect(mockChannel.bindQueue).to.have.been.calledWith('some-queue', 'some-exchange', 'some-key');
    });

    it('should support passing multiple routing keys', async function() {
      sinon.spy(mockChannel, 'bindQueue');

      await topology.createBinding({
        queue: true,
        source: 'some-exchange',
        target: 'some-queue',
        keys: ['some-key', 'some-other-key']
      });

      expect(mockChannel.bindQueue).to.have.been.calledWith('some-queue', 'some-exchange', 'some-key');
      expect(mockChannel.bindQueue).to.have.been.calledWith('some-queue', 'some-exchange', 'some-other-key');
    });
  });

  describe('#getChannel', function() {
    let topology;

    beforeEach(function() {
      topology = constructTopology();
    });

    it('should create a channel', async function() {
      let channel = await topology.getChannel('control');

      expect(channel).to.equal(mockChannel);
    });

    it('should not create a second channel for the same name', async function() {
      sinon.spy(mockConnection, 'createChannel');

      await topology.getChannel('control');
      await topology.getChannel('control');

      expect(mockConnection.createChannel).to.have.been.calledOnce;
    });
  });

  describe('#reset', function() {
    let topology;

    beforeEach(function() {
      topology = constructTopology();
    });

    it('should destroy all channels', async function() {
      await topology.getChannel('control');
      sinon.spy(mockChannel, 'destroy');

      topology.reset();

      expect(mockChannel.destroy).to.have.been.calledWith();
      expect(topology.channels).to.be.empty;
    });

    it('should forget all existing definitions', async function() {
      await topology.createQueue({ name:'some-queue' });
      await topology.createExchange({ name:'some-exchange' });

      await topology.createBinding({
        queue: true,
        source: 'some-exchange',
        target: 'some-queue'
      });

      topology.reset();

      expect(topology.definitions.queues).to.be.empty;
      expect(topology.definitions.exchanges).to.be.empty;
      expect(topology.definitions.bindings).to.be.empty;
    });
  });
});
