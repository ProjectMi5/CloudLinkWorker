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
        console.log(err, body);
        reject('could not perform getOrdersByStatus, maybe server is not reached, or body is not json');
      }
    });
  });
};

rest.prototype.updateOrderStatus = function(orderid, status){
  var options = {
    url:  urljoin(config.rest.host, config.rest.updateOrderStatus),
    rejectUnauthorized: false, // TODO certificate needs to be bundled correctly
    form: {id: orderid, status: status},
    auth: config.auth
  };

  return new Promise(function(resolve, reject){
    request.post(options, function(err, res, body){
      if(err) reject(err);
      try {
        body = JSON.parse(body);
        resolve(body);
      } catch (err){
        console.log(err, body);
        reject('problems in JSON.parse, probably return is not JSON formatted');
      }
    });
  });
};

rest.prototype.updateOrder = function(order){
  var options = {
    url:  urljoin(config.rest.host, config.rest.updateOrder),
    rejectUnauthorized: false, // TODO certificate needs to be bundled correctly
    form: {order: order},
    auth: config.auth
  };

  return new Promise(function(resolve, reject){
    request.post(options, function(err, res, body){
      if(err) reject(err);
      try {
        body = JSON.parse(body);
        resolve(body);
      } catch (err){
        console.log(err, body);
        reject('problems in JSON.parse, probably return is not JSON formatted');
      }
    });
  });
};

rest.prototype.performOrder = function(){
  var options = {
    url:  urljoin(config.rest.host, config.rest.placeOrder),
    rejectUnauthorized: false, // TODO certificate needs to be bundled correctly
    form: {order: '{"recipeId":10010,"parameters":[],"marketPlaceId":"eu"}'},
    auth: config.auth
  };

  return new Promise(function(resolve, reject){
    request.post(options, function(err, res, body){
      if(err) reject(err);
      try {
        body = JSON.parse(body);
        resolve(body);
      } catch (err){
        console.log(err, body);
        reject('problems in JSON.parse, probably return is not JSON formatted');
      }
    });
  });
};

module.exports = new rest();