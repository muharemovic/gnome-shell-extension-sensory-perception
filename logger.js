const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();

var Logger = {
  error: function (msg) {
    log(Me.metadata.uuid + ': ERROR ' + msg);
  },

  debug: function (msg) {
    log(Me.metadata.uuid + ': DEBUG ' + msg);
  }
};
