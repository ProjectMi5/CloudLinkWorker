var assert = require('assert');

before(function(){
  var sslRootCAs = require('ssl-root-cas');
  sslRootCAs
    .inject();
});

describe('REST API', function(){
  it('test connection', function(done){

    var urljoin = require('url-join');
    var request = require('request');
    var config = require('./../config.js');

    var options = {
      url:  urljoin(config.rest.host, 'helloWorld'),
      //auth: config.auth,
    };

    request.get(options, function(err, res, body){
      assert.equal(err, null);

      console.log(body);
      done();
    });
  });
});