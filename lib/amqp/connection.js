// initial version from https://github.com/LeanKit-Labs/wascally

const amqp = require('amqplib')
const fs = require('fs')
const AmqpConnection = require('amqplib/lib/callback_model').CallbackModel
const MachineFactory = require('./machine-factory')

const getUri = (protocol, user, pass, server, port, vhost, heartbeat) =>
  protocol + user + ':' + pass +
    '@' + server + ':' + port + '/' + vhost +
    '?heartbeat=' + heartbeat

const splitAndTrim = (x) => Array.isArray(x)
  ? x
  : typeof x === 'number' && isFinite(x)
    ? [x]
    : x.split(',').map((x) => x.trim(' '))

const createRoundRobinConnect = (parameters = {}, log) => {
  const getConnectionParameters = () => {
    let serverList = parameters.server || 'localhost'
    let portList = parameters.port || 5672
    let p = {
      name: parameters.name || 'default',
      connectionIndex: 0,
      servers: splitAndTrim(serverList),
      ports: splitAndTrim(portList),
      heartbeat: parameters.heartbeat || 30,
      protocol: parameters.protocol || 'amqp://',
      pass: parameters.pass || 'guest',
      user: parameters.user || 'guest',
      vhost: parameters.vhost || '%2f',
      timeout: parameters.timeout,
      certPath: parameters.certPath,
      keyPath: parameters.keyPath,
      caPaths: parameters.caPath,
      passphrase: parameters.passphrase,
      pfxPath: parameters.pfxPath
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
      options.ca = splitAndTrim(p.caPaths).map((caPath) => fs.readFileSync(caPath)) // TODO: use async
    }
    return options
  }

  let p = getConnectionParameters()
  let options = getOptions(p)

  let connectionIndex = 0
  let limit = p.servers.length > p.ports.length ? p.servers.length : p.ports.length

  const getNext = (list) => connectionIndex < list.length ? list[connectionIndex] : list[0]

  const getNextUri = () => {
    let server = getNext(p.servers)
    let port = getNext(p.ports)
    let uri = getUri(p.protocol, p.user, escape(p.pass), server, port, p.vhost, p.heartbeat)
    return uri
  }

  const bumpIndex = () => {
    if (limit - 1 > connectionIndex) {
      connectionIndex++
    }
    connectionIndex = 0
  }

  const connect = () => new Promise((resolve, reject) => {
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
      if (attempted.indexOf(nextUri) < 0) {
        amqp.connect(nextUri, options).then(onConnection, onConnectionError)
      } else {
        log.info(`Cannot connect to ${p.name} - all endpoints failed`)
        reject(new Error('No endpoints could be reached'))
      }
    }
    attempt()
  })

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
const amqpConnectionMachineFactory = (options, logger) => {
  const close = (connection) => connection.close()
  let log = logger.withNamespace('amqp-connection')
  let connect = createRoundRobinConnect(options, log)
  let machine = MachineFactory(connect, AmqpConnection, close, 'close', [], log)
  machine.name = `connection-${options.name || 'default'}`
  return machine
}

module.exports = amqpConnectionMachineFactory
