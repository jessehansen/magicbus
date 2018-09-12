const PublishLog = () => {
  let state = {
    count: 0,
    messages: {},
    sequenceNumber: 0
  }

  const next = () => {
    state.count++
    return (state.sequenceNumber++)
  }

  const add = (m) => {
    let mSeq
    if (m.sequenceNo === undefined) {
      mSeq = next(state)
      m.sequenceNo = mSeq
      state.messages[mSeq] = m
    }
  }

  const remove = (m) => {
    let mSeq = m.sequenceNo !== undefined ? m.sequenceNo : m
    if (state.messages[mSeq]) {
      delete state.messages[mSeq]
      state.count--
      return true
    }
    return false
  }

  const reset = () => {
    let list = Object.values(state.messages).map((m) => {
      delete m.sequenceNo
      return m
    })
    state.sequenceNumber = 0
    state.messages = {}
    state.count = 0
    return list
  }

  return {
    add: add,
    count: () => state.count,
    reset: reset,
    remove: remove
  }
}

module.exports = PublishLog
