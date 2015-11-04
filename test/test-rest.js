var assert = require('assert');

describe('REST API', function(){
  it('test connection', function(done){

    var urljoin = require('url-join');
    var request = require('request');
    var config = require('./../config.js');

    var options = {
      url:  urljoin(config.rest.host, 'helloWorld'),
      rejectUnAuthorized: false
    };

    request.get(options, function(err, res, body){
      assert.equal(err, null);

      console.log(body);
      done();
    });
  });
});