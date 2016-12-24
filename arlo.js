'use strict';
const request = require('request');
const async = require("async");
const util = require('util');
const setup = require('./setup');
const defaultHeaders = {
  'content-type': 'application/json;charset=UTF-8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'request'
};

const CAMERA_OFFLINE_ERRORCODE = '2059';

const arloCb = cb => {
  return (err, resp, body) => {
    if (err) {
      return cb(err);
    }

    var data = JSON.parse(body);
    cb(null, data);
  };
};

function revokeAllAccess(callback) { 
  login(setup.arlo_user_email, setup.arlo_password, (err, loginData) => {
    const auth = loginData.data.token;

    getFriends(auth, (err, friends) => {
      if(err) return callback(err);

      var setupTasks = [];
      friends.data.forEach(friend => { 
        setupTasks.push(cb => {
          if(setup.excluded_emails.indexOf(friend.email) !== -1) {
            return cb(null);
          }
          
          grantFriendAccess(auth, friend, {data:[]}, cb);
        });
      });

      async.parallel(setupTasks, (err) => {
        if(err) {
          return callback('Some failed: ' + err);
        }

        callback(null, 'success');
      });       
    });    
  });
}

function grantAllAccess(callback) { 
  login(setup.arlo_user_email, setup.arlo_password, (err, loginData) => {
    const auth = loginData.data.token;
    var fetchTasks = [];
    fetchTasks.push((cb) => { 
      getFriends(auth, cb);
    });

    fetchTasks.push((cb) => { 
      getDevices(auth, cb);
    });

    async.parallel(fetchTasks, (err, results) => {
      if(err) return callback(err);
      
      var friends = results[0];
      var devices = results[1];

      var setupTasks = [];
      friends.data.forEach(friend => { 
        setupTasks.push(cb => {
          if(setup.excluded_emails.indexOf(friend.email) !== -1) {
            return cb(null);
          }

          grantFriendAccess(auth, friend, devices, cb);
        });
      });

      async.parallel(setupTasks, (err) => {
        if(err) {
          return callback('Some failed: ' + err);
        }

        callback(null, 'success');
      });      
    });    
  });
}

function switchCameras(isOn, callback) { 
  login(setup.arlo_user_email, setup.arlo_password, (err, loginData) => {
    const auth = loginData.data.token;
    getDevices(auth, (err, devices) => {
      if (err) return callback(err);

      var tasks = [];
      devices.data.forEach(device => {
        tasks.push(cb => {
          adjustCameraStatus(auth, device, isOn, cb);
        });
      });

      async.parallel(tasks, (err) => {
        if (err) {
          return callback('Some failed: ' + err);
        }

        callback(null, 'success');
      });
    });
  });
}

function getDevices(auth, cb) {
  var options = {
    url: 'https://arlo.netgear.com/hmsweb/users/devices?t=' + (new Date()).getTime(),
    method: 'GET',
    headers: Object.assign({}, defaultHeaders, {
      'Authorization': auth,
    })
  };

  request(options, arloCb(cb));
}

function getFriends(auth, cb) {
  var options = {
    url: 'https://arlo.netgear.com/hmsweb/users/friends',
    method: 'GET',
    headers: Object.assign({}, defaultHeaders, {
      'Authorization': auth,
    })
  };

  request(options, arloCb(cb));
}

function login(email, pass, cb) {
  var body = JSON.stringify({
    email: email,
    password: pass
  });

  var options = {
    url: 'https://arlo.netgear.com/hmsweb/login',
    method: 'POST',
    headers: Object.assign({}, defaultHeaders, {
      'Content-Length': body.length,
    }),
    body: body
  };

  request(options, arloCb(cb));
}

function adjustCameraStatus(auth, device, isOn, cb) {
  var reqBody = JSON.stringify({
    "from": "J52E3JK-336-7314218_web",
    "to": device.deviceId,
    "action": "set",
    "resource": "cameras/" + device.deviceId,
    "transId": "web!64ad420b.01f63!1482369272406",
    "publishResponse": true,
    "properties": {
      "privacyActive": !isOn,
      "idleLedEnable": isOn
    }
  });

  var options = {
    url: 'https://arlo.netgear.com/hmsweb/users/devices/notify/' + device.deviceId,
    method: 'POST',
    headers: Object.assign({}, defaultHeaders, {
      'Content-Length': reqBody.length,
      'Authorization': auth,
      'xcloudId': device.xCloudId
    }),
    body: reqBody
  };

  request(options, arloCb((err, data) => {
    if (err || (!data.success && data.data.error !== CAMERA_OFFLINE_ERRORCODE)) {
      return cb(util.format('deviceId: (%s) failed for the following reason: (%s)', device.deviceId, err || JSON.stringify(data)));
    }

    cb();
  }));
}

function grantFriendAccess(auth, friend, devices, cb) { 
var reqBody = JSON.stringify({
    "firstName": friend.firstName,
    "lastName": friend.lastName,
    "devices": devices.data.reduce((acc, device) => { 
      acc[device.uniqueId] = device.deviceName;
      return acc;
    }, {}), 
    "lastModified": friend.lastModified,
    "adminUser": friend.adminUser,
    "email": friend.email,
    "id": friend.id
  });

  var options = {
    url: 'https://arlo.netgear.com/hmsweb/users/friends',
    method: 'PUT',
    headers: Object.assign({}, defaultHeaders, {
      'Content-Length': reqBody.length,
      'Authorization': auth,
    }),
    body: reqBody
  };

  request(options, arloCb((err, data) => {
    if (err || (!data.success)) {
      return cb(util.format('friendId: (%s) failed to %s access for the following reason: (%s)',
        friend.id,
        devices.length === 0 ? 'revoke' : 'grant',
        err || JSON.stringify(data)));
    }

    cb();
  }));
}

exports.switchCameras = switchCameras;
exports.revokeAllAccess = revokeAllAccess;
exports.grantAllAccess = grantAllAccess;