const EventEmitter = require("events").EventEmitter;

class Actions extends EventEmitter {
  next() {
    this.emit("next");
  }

  error(err) {
    this.emit("error", err);
  }
}

module.exports = Actions;
