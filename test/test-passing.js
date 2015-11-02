var assert = require('assert');

describe('Basic Mocha functionality testing', function (t) {
  it('equal 1 to "1"', function(){
    assert.equal('1',1,'equal == coerces values to strings');
  });

  it('promise should return 1337', function(){
    var Promise = require('bluebird');
    var leet = new Promise(function(resolve){
      resolve(1337);
    });

    return leet.then(function(value){
      assert.equal(value,1337, 'A leet promise should always return 1337');
    });
  });

  it('callback style async leet 1337', function(done){
    function leet(cb){
      setTimeout(function(){
        cb(false, 1337);
      });
    }

    leet(function(err, value){
      assert.equal(value, 1337, 'A leet cb function should also return 1337');
      done();
    })
  })
});