const arlo = require('./arlo.js');

exports.turnOn = function(event, context, cb) {
   arlo.switchCameras(true, cb);
}

exports.turnOff = function(event, context, cb) {
   arlo.switchCameras(false, cb);
}

exports.revokeAllAccess = function(event, context, cb) { 
  arlo.revokeAllAccess(cb);
}

exports.grantAllAccess = function(event, context, cb) { 
  arlo.grantAllAccess(cb);
}

arlo.revokeAllAccess(console.log);