const PublishOptions = require('../lib/publisher/publish-options')

describe('PublishOptions', () => {
  const next = () => Promise.resolve
  let context
  let filter
  beforeEach(() => {
    context = {}

    filter = PublishOptions
  })

  it('should set publishOptions to the default options', async () => {
    await filter(context, next)
    expect(context.publishOptions).toEqual({ persistent: true })
  })

  it('should add to existing publishOptions', async () => {
    context.publishOptions = { some: 'option' }
    await filter(context, next)
    expect(context.publishOptions).toEqual({ some: 'option', persistent: true })
  })

  it('should not override with the defaults', async () => {
    context.publishOptions = { persistent: false }
    await filter(context, next)
    expect(context.publishOptions).toEqual({ persistent: false })
  })

  it('should support inspect', async () => {
    expect(filter.inspect()).toEqual(expect.objectContaining({
      type: 'Get Publishing Options',
      defaults: { persistent: true }
    }))
  })
})
