var CONFIG = require('./../config');
var _ = require('underscore');
var async = require("async");

/**
 * 
 * 
 * @async
 * @param recipeId
 * @param userparameters
 * @callback callback(taskId)
 */
function setOrder(order, userParameters, callback) {
  var assert = require('assert');
  assert(typeof callback === 'function');
  assert(typeof order === 'object', 'order must be an object');
  assert(_.isArray(userParameters));

  var opc = require('./simpleOpcua').server(CONFIG.OPCUAOrder);
  opc.initialize(function(err) {
    if (err) {
      console.log(err);
      callback(err);
      return 0;
    }

    opc.mi5Subscribe();
    var queue = opc.mi5Monitor('MI5.Order[0].Pending');
    queue.on('changed', function(data) {
      if (data.value.value === false) {
        // Queue is ready
        console.log('Recipe Tool - monitor Pending changed: ', data.value.value, ' -- order!');

        // Write Order in MI5.Order
        async.series([ function(callback) {
          opc.mi5WriteOrder('MI5.Order[0]', order, userParameters, callback);
        } ], function(err) {
          opc.disconnect();
          callback(err); // final callback
        });
      } else {
        // no action, wait until queue is ready
        console.log('Waiting... Pending is: ', data.value.value);
      }
    });

  });

}
exports.setOrder = setOrder;
