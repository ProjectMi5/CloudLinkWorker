var assert = require('chai').assert;

describe('REST API', function(){
  var rest = require('./../mi5-modules/rest');

  it('test connection', function(){
    return rest.checkConnection()
      .then(function(status){
        assert.equal(status.status, 'ok', 'checkConnection must return {status: "ok"}');
      });
  });

  it('get orders', function(){
    return rest.getOrders()
      .then(function(orders){
        assert.isArray(orders, 'orders must be an array, even an empty one');
      });
  });
});