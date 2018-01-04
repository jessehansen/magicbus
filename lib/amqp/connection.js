// initial version from https://github.com/LeanKit-Labs/wascally

const amqp = require('amqplib')
const _ = require('lodash')
const fs = require('fs')
const AmqpConnection = require('amqplib/lib/callback_model').CallbackModel
const MachineFactory = require('./machine-factory')
const Promise = require('bluebird')

function getArgs (fn) {
  let fnString = fn.toString()
  return /[(]([^)]*)[)]/.exec(fnString)[1].split(',').map(function (x) {
    return String.prototype.trim.bind(x)()
  })
}

function supportsDefaults (opts) {
  return opts.get && getArgs(opts.get).length > 1
}

function trim (x) {
  return x.trim(' ')
}

function getOption (opts, key, alt) {
  if (opts.get && supportsDefaults(opts.get)) {
    return opts.get(key, alt)
  }
  return opts[key] || alt
}

function getUri (protocol, user, pass, server, port, vhost, heartbeat) {
  return protocol + user + ':' + pass +
    '@' + server + ':' + port + '/' + vhost +
    '?heartbeat=' + heartbeat
}

function split (x) {
  if (_.isNumber(x)) {
    return [x]
  }
  if (_.isArray(x)) {
    return x
  }
  return x.split(',').map((x) => trim(x))
}

function CreateRoundRobinConnectFunction (parameters, log) {
  /* eslint-disable complexity */
  const getConnectionParameters = () => {
    let serverList = getOption(parameters, 'RABBIT_BROKER') || getOption(parameters, 'server', 'localhost')
    let portList = getOption(parameters, 'RABBIT_PORT') || getOption(parameters, 'port', 5672)
    let p = {
      name: parameters ? (parameters.name || 'default') : 'default',
      connectionIndex: 0,
      servers: split(serverList),
      ports: split(portList),
      heartbeat: getOption(parameters, 'RABBIT_HEARTBEAT') || getOption(parameters, 'heartbeat', 30),
      protocol: getOption(parameters, 'RABBIT_PROTOCOL') || getOption(parameters, 'protocol', 'amqp://'),
      pass: getOption(parameters, 'RABBIT_PASSWORD') || getOption(parameters, 'pass', 'guest'),
      user: getOption(parameters, 'RABBIT_USER') || getOption(parameters, 'user', 'guest'),
      vhost: getOption(parameters, 'RABBIT_VHOST') || getOption(parameters, 'vhost', '%2f'),
      timeout: getOption(parameters, 'RABBIT_TIMEOUT') || getOption(parameters, 'timeout'),
      certPath: getOption(parameters, 'RABBIT_CERT') || getOption(parameters, 'certPath'),
      keyPath: getOption(parameters, 'RABBIT_KEY') || getOption(parameters, 'keyPath'),
      caPaths: getOption(parameters, 'RABBIT_CA') || getOption(parameters, 'caPath'),
      passphrase: getOption(parameters, 'RABBIT_PASSPHRASE') || getOption(parameters, 'passphrase'),
      pfxPath: getOption(parameters, 'RABBIT_PFX') || getOption(parameters, 'pfxPath')
    }
    p.useSSL = p.certPath || p.keyPath || p.passphrase || p.caPaths || p.pfxPath
    if (p.useSSL) {
      p.protocol = 'amqps://'
    }
    return p
  }

  const getOptions = (p) => {
    let options = { noDelay: true }
    if (p.timeout) {
      options.timeout = p.timeout
    }
    if (p.certPath) {
      options.cert = fs.readFileSync(p.certPath)
    }
    if (p.keyPath) {
      options.key = fs.readFileSync(p.keyPath)
    }
    if (p.passphrase) {
      options.passphrase = p.passphrase
    }
    if (p.pfxPath) {
      options.pfx = fs.readFileSync(p.pfxPath)
    }
    if (p.caPaths) {
      let list = p.caPaths.split(',')
      options.ca = list.map(function (caPath) {
        return fs.readFileSync(caPath)
      })
    }
    return options
  }
  /* eslint-enable complexity */

  let p = getConnectionParameters()
  let options = getOptions(p)

  let connectionIndex = 0
  let limit = _.max([p.servers.length, p.ports.length])

  const getNext = function (list) {
    if (connectionIndex >= list.length) {
      return list[0]
    }
    return list[connectionIndex]
  }

  const getNextUri = function () {
    let server = getNext(p.servers)
    let port = getNext(p.ports)
    let uri = getUri(p.protocol, p.user, escape(p.pass), server, port, p.vhost, p.heartbeat)
    return uri
  }

  const bumpIndex = function () {
    if (limit - 1 > connectionIndex) {
      connectionIndex++
    } else {
      connectionIndex = 0
    }
  }

  const connect = function () {
    return new Promise((resolve, reject) => {
      let attempted = []
      const attempt = () => {
        let nextUri = getNextUri()
        log.info(`Attempting connection to ${p.name} (${nextUri})`)
        const onConnection = (connection) => {
          connection.uri = nextUri
          log.info(`Connected to ${p.name} (${nextUri})`)
          resolve(connection)
        }
        const onConnectionError = (err) => {
          log.info(`Failed to connect to ${p.name} (${nextUri})`, err)
          attempted.push(nextUri)
          bumpIndex()
          attempt(err)
        }
        if (_.indexOf(attempted, nextUri) < 0) {
          amqp.connect(nextUri, options).then(onConnection, onConnectionError)
        } else {
          log.info(`Cannot connect to ${p.name} - all endpoints failed`)
          reject(new Error('No endpoints could be reached'))
        }
      }
      attempt()
    })
  }

  return connect
}

/**
 * Creates an amqp connection state machine that reacts to connection state changes.
 * @param {Object} options - connection options
 * @param {String} options.name - connection name
 * @param {String} options.server - list of servers to connect to, separated by ','
 * @param {String} options.port - list of ports to connect to, separated by ','. Must have the same number of
      entries as options.server
 * @param {Number} options.heartbeat - heartbeat timer - defaults to 30 seconds
 * @param {String} options.protocol - connection protocol - defaults to amqp:// or amqps://
 * @param {String} options.user - user name - defaults to guest
 * @param {String} options.pass - password - defaults to guest
 * @param {String} options.vhost - vhost to connect to - defaults to '/'
 * @param {String} options.timeout - connection timeout
 * @param {String} options.certPath - certificate file path (for SSL)
 * @param {String} options.keyPath - key file path (for SSL)
 * @param {String} options.caPath - certificate file path(s), separated by ',' (for SSL)
 * @param {String} options.passphrase - certificate passphrase (for SSL)
 * @param {String} options.pfxPath - pfx file path (for SSL)
 * @param {Object} logger - the logger
 * @returns {Object} a state machine with all of the amqplib.Connection functions exposed on it
 */
module.exports = function CreateAmqpConnectionMachine (options, logger) {
  const close = function (connection) {
    connection.close()
  }
  let log = logger.withNamespace('amqp-connection')
  let connect = CreateRoundRobinConnectFunction(options, log)
  let machine = MachineFactory(connect, AmqpConnection, close, 'close', [], log)
  machine.name = `connection-${options.name || 'default'}`
  return machine
}
