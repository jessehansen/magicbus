// initial version from https://github.com/LeanKit-Labs/wascally

var _ = require('lodash');
var Monologue = require('monologue.js');
var signal = require('postal').channel('rabbit.ack');
var Promise = require('bluebird');

var calls = {
  ack: '_ack',
  nack: '_nack',
  reject: '_reject'
};

var AckBatch = function(name, connectionName, resolver, logger) {
  this.name = name;
  this.connectionName = connectionName;
  this.lastAck = -1;
  this.lastNack = -1;
  this.lastReject = -1;
  this.firstAck = undefined;
  this.firstNack = undefined;
  this.firstReject = undefined;
  this.messages = [];
  this.receivedCount = 0;
  this.resolver = resolver;
  this.logger = logger.scoped('batch');
};

AckBatch.prototype._ack = function(tag, inclusive) {
  this.lastAck = tag;
  this._resolveTag(tag, 'ack', inclusive);
};

AckBatch.prototype._ackOrNackSequence = function() {
  try {
    var firstMessage = this.messages[0];
    if (firstMessage === undefined) {
      return;
    }
    var firstStatus = firstMessage.status;
    var sequenceEnd = firstMessage.tag;
    var call = calls[firstStatus];
    if (firstStatus === 'pending') {
      this.logger.debug('First message in batch pending, cannot process batch');
      return;
    } else {
      for (var i = 1; i < _.size(this.messages) - 1; i++) {
        if (this.messages[i].status !== firstStatus) {
          break;
        }
        sequenceEnd = this.messages[i].tag;
      }
      if (call) {
        this[call](sequenceEnd, true);
      }
    }
  } catch (err) {
    this.logger.error(`An exception occurred while trying to resolve ack/nack sequence on ${this.name} - ${this.connectionName}`, err);
  }
};

AckBatch.prototype._firstByStatus = function(status) {
  return _.find(this.messages, { status: status });
};

AckBatch.prototype._lastByStatus = function(status) {
  return _.findLast(this.messages, { status: status });
};

AckBatch.prototype._nack = function(tag, inclusive) {
  this.lastNack = tag;
  this._resolveTag(tag, 'nack', inclusive);
};

AckBatch.prototype._reject = function(tag, inclusive) {
  this.lastReject = tag;
  this._resolveTag(tag, 'reject', inclusive);
};

AckBatch.prototype._processBatch = function() {
  this.acking = this.acking !== undefined ? this.acking : false;
  if (!this.acking) {
    this.acking = true;
    this.logger.debug(`Ack/Nack/Reject - ${this.messages.length} messages`);
    var hasPending = (_.findIndex(this.messages, { status: 'pending' }) >= 0);
    var hasAck = this.firstAck;
    var hasNack = this.firstNack;
    var hasReject = this.firstReject;

    this.logger.debug(`Pending: ${hasPending}, Ack: ${hasAck}, Nack: ${hasNack}, Reject: ${hasReject}`);
    // just acks
    if (!hasPending && !hasNack && hasAck && !hasReject) {
      this._resolveAll('ack', 'firstAck', 'lastAck');
    }
    // just nacks
    else if (!hasPending && hasNack && !hasAck && !hasReject) {
      this._resolveAll('nack', 'firstNack', 'lastNack');
    }
    // just rejects
    else if (!hasPending && !hasNack && !hasAck && hasReject) {
      this._resolveAll('reject', 'firstReject', 'lastReject');
    }
    // acks, nacks or rejects
    else if (hasNack || hasAck || hasReject) {
      this._ackOrNackSequence();
      this.acking = false;
    }
    // nothing to do
    else {
      this.resolver('waiting');
      this.acking = false;
    }
  }
};

AckBatch.prototype._resolveAll = function(status, first, last) {
  var count = this.messages.length;
  var emitEmpty = function() {
    setTimeout(function() {
      this.emit('empty');
    }.bind(this), 0);
  }.bind(this);
  if (this.messages.length !== 0) {
    var lastTag = this._lastByStatus(status).tag;
    this.logger.info(`${status} ALL (${this.messages.length}) tags on ${this.name} - ${this.connectionName}.`);
    this.resolver(status, { tag: lastTag, inclusive: true })
      .then(function() {
        this[last] = lastTag;
        this._removeByStatus(status);
        this[first] = undefined;
        if (count > 0 && this.messages.length === 0) {
          this.logger.info(`No pending tags remaining on queue ${this.name} - ${this.connectionName}`);
          // The following setTimeout is the only thing between an insideous heisenbug and your sanity:
          // The promise for ack/nack will resolve on the channel before the server has processed it.
          // Without the setTimeout, if there is a pending cleanup/shutdown on the channel from the queueFsm,
          // the channel close will complete and cause the server to ignore the outstanding ack/nack command.
          // I lost HOURS on this because doing things that slow down the processing of the close cause
          // the bug to disappear.
          // Hackfully yours,
          // Alex
          emitEmpty();
        }
        this.acking = false;
      }.bind(this));
  }
};

AckBatch.prototype._resolveTag = function(tag, operation, inclusive) {
  var removed = this._removeUpToTag(tag);
  var nextAck = this._firstByStatus('ack');
  var nextNack = this._firstByStatus('nack');
  var nextReject = this._firstByStatus('reject');
  this.firstAck = nextAck ? nextAck.tag : undefined;
  this.firstNack = nextNack ? nextNack.tag : undefined;
  this.firstReject = nextReject ? nextReject.tag : undefined;
  this.logger.info(`${operation} ${removed.length} tags (${inclusive?'inclusive':'individual'}) on ${this.name} - ${this.connectionName}. (Next ack: ${this.firstAck || 0}, Next nack: ${this.firstNack || 0}, Next reject: ${this.firstReject || 0})`);
  this.resolver(operation, { tag: tag, inclusive: inclusive });
};

AckBatch.prototype._removeByStatus = function(status) {
  return _.remove(this.messages, function(message) {
    return message.status === status;
  });
};

AckBatch.prototype._removeUpToTag = function(tag) {
  return _.remove(this.messages, function(message) {
    return message.tag <= tag;
  });
};

AckBatch.prototype.addMessage = function(message) {
  this.receivedCount++;
  var status = message.message || message;
  this.messages.push(status);
  this.logger.debug(`New pending tag ${status.tag} on queue ${this.name} - ${this.connectionName}`);
};

AckBatch.prototype.getMessageOps = function(tag) {
  var message = {
    tag: tag,
    status: 'pending'
  };
  return {
    message: message,
    ack: function() {
      this.logger.debug(`Marking tag ${tag} as ack\'d on queue ${this.name} - ${this.connectionName}`);
      this.firstAck = this.firstAck || tag;
      message.status = 'ack';
    }.bind(this),
    nack: function() {
      this.logger.debug(`Marking tag ${tag} as nack\'d on queue ${this.name} - ${this.connectionName}`);
      this.firstNack = this.firstNack || tag;
      message.status = 'nack';
    }.bind(this),
    reject: function() {
      this.logger.debug(`Marking tag ${tag} as rejected on queue ${this.name} - ${this.connectionName}`);
      this.firstReject = this.firstReject || tag;
      message.status = 'reject';
    }.bind(this)
  };
};

AckBatch.prototype.flush = function() {
  var self = this;
  this.logger.debug(`Flushing ack batch with ${this.messages.length} messages`);
  function step() {
    self._processBatch();
    return Promise.delay(0) // see comment about heisenbug above. This gives amqplib enough time to actually resolve all messages
      .then(function(){
        if (self.messages.length) {
          return step();
        } else {
          this.logger.debug('Ack batch is empty');
        }
      });
  };
  return step();
}

AckBatch.prototype.ignoreSignal = function() {
  if (this.signalSubscription) {
    this.signalSubscription.unsubscribe();
  }
};

AckBatch.prototype.listenForSignal = function() {
  if (!this.signalSubscription) {
    this.signalSubscription = signal.subscribe('#', function() {
      this.logger.debug('Received ack signal, processing ack batch');
      this._processBatch();
    }.bind(this));
  }
};

Monologue.mixInto(AckBatch);

module.exports = AckBatch;
