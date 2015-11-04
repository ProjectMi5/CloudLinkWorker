/**
 *
 * @type {*|exports|module.exports}
 */
var urljoin = require('url-join');
var request = require('request');
var Promise = require('bluebird');

var config = require('./../config.js');

function rest(){}

rest.prototype.checkConnection = function(){
  var options = {
    url:  urljoin(config.rest.host, 'helloWorld'),
    rejectUnauthorized: false, // TODO certificate needs to be bundled correctly
    auth: config.auth
  };

  return new Promise(function(resolve, reject){
    request.get(options, function(err, res, body){
      if(err) reject(err);
      if(body == 'Hello World!'){
        resolve({status: 'ok'});
      }
    });
  });
};

rest.prototype.getOrdersByStatus = function(status){
  var options = {
    url:  urljoin(config.rest.host, config.rest.getOrdersByStatus),
    rejectUnauthorized: false, // TODO certificate needs to be bundled correctly
    form: {status: status},
    auth: config.auth
  };

  return new Promise(function(resolve, reject){
    request.post(options, function(err, res, body){
      if(err) reject(err);
      try {
        body = JSON.parse(body);
        resolve(body);
      } catch (err){
        reject(err);
      }
    });
  });
}

module.exports = new rest();