const PublishLog = require('../lib/publish-log')

describe('PublishLog', () => {
  let log
  let message1
  let message2
  beforeEach(() => {
    log = PublishLog()
    message1 = {}
    message2 = {}
  })

  it('should add a sequenceNo when adding to log', () => {
    log.add(message1)
    expect(message1.sequenceNo).not.toBeUndefined()
  })

  it('should ignore if same message is added twice', () => {
    log.add(message1)
    let originalSeq = message1.sequenceNo
    log.add(message1)
    expect(message1.sequenceNo).toBe(originalSeq)
  })

  it('should keep sequenceNo unique when adding to log', () => {
    log.add(message1)
    log.add(message2)
    expect(message2.sequenceNo).not.toEqual(message1.sequenceNo)
  })

  it('should keep count of messages added', () => {
    log.add(message1)
    log.add(message2)
    expect(log.count()).toEqual(2)
  })

  it('should allow removing from log', () => {
    log.add(message1)
    log.add(message2)
    let result = log.remove(message1)
    expect(result).toEqual(true)
    expect(log.count()).toEqual(1)
  })

  it('should return false when unknown message is removed', () => {
    log.add(message1)
    let result = log.remove(message2)
    expect(log.count()).toEqual(1)
    expect(result).toEqual(false)
  })

  describe('#reset', () => {
    beforeEach(() => {
      log.add(message1)
      log.add(message2)
    })

    it('should reset count to 0', () => {
      log.reset()
      expect(log.count()).toEqual(0)
    })

    it('should continue giving unique sequenceNo', () => {
      log.reset()
      let message3 = {}
      log.add(message3)
      expect(message3.sequenceNo).not.toEqual(message1.sequenceNo)
      expect(message3.sequenceNo).not.toEqual(message2.sequenceNo)
    })

    it('should return messages in added order', () => {
      let loggedMessages = log.reset()
      expect(loggedMessages).toEqual([message1, message2])
    })

    it('should return no messages if it is empty', () => {
      log.reset()
      let loggedMessages = log.reset()
      expect(loggedMessages).toHaveLength(0)
    })
  })
})
