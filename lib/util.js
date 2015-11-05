var _ = require('lodash');

function fixConnectionInfo(connectionInfo) {
  var cxn = _.cloneDeep(connectionInfo);
  if (cxn.user && cxn.password) {
    cxn.username = cxn.user;
    delete cxn.user;
  }
  if (cxn.host) {
    cxn.hostname = cxn.host;
    delete cxn.host;
  }
  return cxn;
}

module.exports = {fixConnectionInfo:fixConnectionInfo};
