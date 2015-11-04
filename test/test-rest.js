var assert = require('chai').assert;

describe('REST API', function(){
  it('test connection', function(done){

    var urljoin = require('url-join');
    var request = require('request');
    var config = require('./../config.js');

    var options = {
      url:  urljoin(config.rest.host, 'helloWorld'),
      rejectUnauthorized: false, // TODO certificate needs to be bundled correctly
      auth: config.auth
    };

    request.get(options, function(err, res, body){
      assert.equal(err, null);
      assert.equal(body, 'Hello World!');
      done();
    });
  });

  it('get orders', function(done){

    var urljoin = require('url-join');
    var request = require('request');
    var config = require('./../config.js');

    var options = {
      url:  urljoin(config.rest.host, config.rest.getOrders),
      rejectUnauthorized: false, // TODO certificate needs to be bundled correctly
      auth: config.auth
    };

    request.get(options, function(err, res, body){
      assert.equal(err, null);
      body = JSON.parse(body);
      assert.isArray(body, 'body needs to be an array');
      done();
    });
  });
});