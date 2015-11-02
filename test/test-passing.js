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
});