// initial version from https://github.com/LeanKit-Labs/wascally

const Monologue = require('monologue.js')
const machina = require('machina')

let staticId = 0

/**
 * Creates a state machine around a target class that has a lifetime
 * @param {Function} factory - the factory function to call when acquiring a resource. Should return a Promise
      that resolves with the resource.
 * @param {Function} target - the constructor function (or class definition) for the resource. Each method on
      the prototype of this function will be exposed on the resulting state machine.
 * @param {bool} release - does the machine need to release the resource
 * @param {String} disposalEvent - event that resource will fire when disposed or lost (defaults to 'close')
 * @param {Object} logger - the logger
 * @returns {PromiseMachine}
 */
const machineFactory = (factory, target, release, disposalEvent, disableDeferForOperations, logger) => {
  /**
   * State Machine representing an arbitrary resource, with states around connection and disposal
   * @class PromiseMachine
   * @private
   */
  const PromiseMachine = machina.Fsm.extend({
    id: staticId++,
    initialState: 'acquiring',
    item: undefined,
    waitInterval: 0,
    waitMax: 5000,

    /**
     * Does the work in acquiring a resource and sets up events for state transitions.
     *
     * @private
     * @memberOf PromiseMachine.prototype
     */
    doAcquire: function () {
      this.emit('acquiring')
      const onAcquisitionError = (err) => {
        logger.debug('Resource acquisition failed with error', err)
        this.emit('failed', err)
        this.handle('failed')
      }
      const onAcquired = (o) => {
        this.item = o
        this.waitInterval = 0
        if (this.item.on) {
          this.disposeHandle = this.item.once(disposalEvent || 'close', (err) => {
            logger.info('Resource lost, releasing', err)
            this.emit('lost')
            this.transition('released')
          })
          this.item.once('error', (err) => {
            logger.info('Resource error', err)
            this.transition('failed')
          })
          this.item.on('drain', () => {
            this.emit('drain')
          })
        }
        this.transition('acquired')
      }
      const onException = (ex) => {
        logger.debug('Resource acquisition failed with exception', ex)
        this.emit('failed', ex)
        this.handle('failed')
      }
      factory()
        .then(onAcquired, onAcquisitionError)
        .catch(onException)
    },

    /**
     * Does the work in disposing a resource
     *
     * @private
     * @memberOf PromiseMachine.prototype
     */
    doDispose: function () {
      if (this.item) {
        if (this.item.removeAllListeners) {
          this.item.removeAllListeners()
        }
        if (!this.item) {
          return
        }
        if (release) {
          release(this.item)
        } else {
          this.item.close()
        }
        this.item = undefined
      }
    },

    /**
     * Acquire the resource
     *
     * @public
     * @memberOf PromiseMachine.prototype
     */
    acquire: function () {
      this.handle('acquire')
      return this
    },

    /**
     * Destroy the resource. Resource cannot be reacquired.
     *
     * @public
     * @memberOf PromiseMachine.prototype
     */
    destroy: function () {
      if (this.retry) {
        clearTimeout(this.retry)
      }
      this.handle('destroy')
    },

    /**
     * Run an operation on a resource
     *
     * @public
     * @memberOf PromiseMachine.prototype
     * @param {String} call - which method is being called on the resource
     * @param {Array} args - arguments to pass to the method
     * @returns {Promise} a promise that resolves with the value of the operation or rejects with an error
          from the operation
     */
    operate: function (call, args) {
      let op = { operation: call, argList: args, index: this.index },
        promise = new Promise((resolve, reject) => {
          op.resolve = resolve
          op.reject = reject
        })
      this.handle('operate', op)
      return promise
    },

    /**
     * Release the resource. Resource can be reacquired after release.
     *
     * @public
     * @memberOf PromiseMachine.prototype
     */
    release: function () {
      if (this.retry) {
        clearTimeout(this.retry)
      }
      this.handle('release')
    },

    /**
     * States and transitions
     *
     * @public
     * @memberOf PromiseMachine.prototype
     */
    states: {
      /**
       * Initial state - begins acquiring resource
       * @memberOf PromiseMachine.prototype.states
       */
      acquiring: {
        _onEnter: function () {
          this.doAcquire()
        },
        failed: function () {
          setTimeout(() => {
            this.transition('failed')
            if ((this.waitInterval + 100) < this.waitMax) {
              this.waitInterval += 100
            }
          }, this.waitInterval)
        },
        destroy: function () {
          this.doDispose()
          this.transition('destroyed')
        },
        release: function () {
          this.doDispose()
          this.transition('released')
        },
        operate: function (call) {
          if (disableDeferForOperations.indexOf(call.operation) === -1) {
            this.deferUntilTransition('acquired')
          }
        }
      },
      /**
       * Resource acquired successfully
       * @memberOf PromiseMachine.prototype.states
       */
      acquired: {
        _onEnter: function () {
          this.emit('acquired')
        },
        destroy: function () {
          this.doDispose()

          this.transition('destroyed')
        },
        operate: function (call) {
          try {
            let result = this.item[call.operation].apply(this.item, call.argList)
            if (result && result.then) {
              result
                .then(call.resolve)
                .then(null, call.reject)
            } else {
              call.resolve(result)
            }
          } catch (error) {
            call.reject(error)
          }
        },
        invalidated: function () {
          this.transition('acquiring')
        },
        release: function () {
          this.doDispose()
          this.transition('released')
        }
      },
      /**
       * Resource disposed
       * @memberOf PromiseMachine.prototype.states
       */
      destroyed: {
        _onEnter: function () {
          this.emit('destroyed', this.id)
        }
      },
      /**
       * Resource disposed, but can be reacquired
       * @memberOf PromiseMachine.prototype.states
       */
      released: {
        _onEnter: function () {
          this.emit('released', this.id)
        },
        acquire: function () {
          this.transition('acquiring')
        },
        operate: function (call) {
          if (disableDeferForOperations.indexOf(call.operation) === -1) {
            this.deferUntilTransition('acquired')
          }
          this.transition('acquiring')
        },
        destroy: function () {
          this.transition('destroyed')
        }
      },
      /**
       * Failed to acquire resource
       * @memberOf PromiseMachine.prototype.states
       */
      failed: {
        _onEnter: function () {
          this.emit('failed', this.lastError)
          this.retry = setTimeout(() => {
            this.transition('acquiring')
            if ((this.waitInterval + 100) < this.waitMax) {
              this.waitInterval += 100
            }
          }, this.waitInterval)
        },
        destroy: function () {
          this.doDispose()
          this.transition('destroyed')
        },
        operate: function (call) {
          if (disableDeferForOperations.indexOf(call.operation) === -1) {
            this.deferUntilTransition('acquired')
          }
        }
      }
    }
  })

  Monologue.mixInto(PromiseMachine)
  let machine = new PromiseMachine()
  Object.entries(target.prototype).forEach(([name, prop]) => {
    if (typeof prop === 'function') {
      machine[name] = (...args) => machine.operate(name, args)
    }
  })
  machine.on('transition', (data) => {
    logger.debug(`Machine ${machine.name || 'unnamed'}: ${data.fromState} -> ${data.toState}`)
  })
  machine.on('deferred', (data) => {
    logger.silly(`Machine ${machine.name || 'unnamed'}: deferred method ${JSON.stringify(data)}`)
  })
  return machine
}

module.exports = machineFactory
