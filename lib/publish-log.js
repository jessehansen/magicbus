/**
 * Represents a log of published messages in sequential order. Used for keeping messages that need to be (re)published
      upon exchange (re)connection
 */
const createPublishLog = () => {
  let state = {
    count: 0,
    messages: {},
    sequenceNumber: 0,
  };

  /**
   * Gets the next sequence number
   * @private
   */
  const next = () => {
    state.count++;
    return state.sequenceNumber++;
  };

  /**
   * Adds a message to the log
   * @public
   */
  const add = (m) => {
    let mSeq;
    if (!state.messages.sequenceNo) {
      mSeq = next(state);
      m.sequenceNo = mSeq;
      state.messages[mSeq] = m;
    }
  };

  /**
   * Removes a message from the log
   * @public
   */
  const remove = (m) => {
    let mSeq = m.sequenceNo !== undefined ? m.sequenceNo : m;
    if (state.messages[mSeq]) {
      delete state.messages[mSeq];
      state.count--;
      return true;
    }
    return false;
  };

  /**
   * Resets the log
   * @public
   */
  const reset = () => {
    let list = state.messages.map((m) => {
      delete m.sequenceNo;
      return m;
    });
    state.sequenceNumber = 0;
    state.messages = {};
    state.count = 0;
    return list;
  };

  return {
    add: add,
    count: () => state.count,
    reset: reset,
    remove: remove,
  };
};

module.exports = createPublishLog;
