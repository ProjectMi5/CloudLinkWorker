var _ = require('underscore');
var Promise = require('bluebird');

var Worker = require('./mi5-modules/worker');

/**
 * Execute accepted orders
 * -----------------------
 * Get every minute a complete list
 * (in addition to mqtt, since it might be possible due to connection problems, that we miss some?)
 */
Worker.prototype.executeAcceptedOrders = function() {
  var self = this;
  var currentOrder;
  return self.getAcceptedOrders()
    .then(self.manageIncomingOrdersArray)
    .then(self.computeNextOrder)
    .then(function(order){
      currentOrder = order;
      console.log('INFO: Next order will be:', order);
      return new Promise(function(res){res(order);}).bind(self); // continue the promise chain with the order
    })
    .then(self.executeOrder)
    .then(function() {
      console.log('INFO: order was executed');
      return self.setInProgressToOrder(currentOrder);
    })
    .then(function(){
      console.log('INFO: order is now in progress');
    })
    .catch(function(err){
      if(err == 'OrderListIsEmpty'){}
      else {
        console.log('ERROR',err);
      }
    });
};

/**
 * Accepted pending orders
 * -----------------------
 * Get every minute a complete list
 * (in addition to mqtt, since it might be possible due to connection problems, that we miss some?)
 */
Worker.prototype.acceptPendingOrders = function() {
  var self = this;

  return self.getPendingOrders()
    .then(self.manageIncomingOrdersArray)
    .then(self.computeNextOrder)
    .then(function(order){
      // Debug output
      console.log('INFO: Next order to accept', order);
      // continue the promise chain with the order
      return new Promise(function(res){res(order);}).bind(self);
    })
    // Compute time until production
    .then(self.computeTimeUntilCompletion)
    .spread(self.acceptOrder)
    .then(function(){
      console.log('SUCCESS: order is now in accepted');
    })
    .catch(function(err){
      if(err == 'OrderListIsEmpty'){}
      else {
        console.log('ERROR',err);
      }
    });
};

///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////

Worker.prototype.run = function(){
  var self = this;
  return self.executeAcceptedOrders()
    .then(self.wait)
    .then(function(){
      return self.run();
    });
};

Worker.prototype.runAccept = function(){
  var self = this;
  return self.acceptPendingOrders()
    .then(self.wait)
    .then(function(){
      return self.runAccept();
    });
};

///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////

var CLW = new Worker(); // CloudLinkWorker
CLW.run();
CLW.runAccept();

///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Listen to changes via MQTT
 */
//mqtt.on('newOrder', function(topic, message){
//  // if order pending:
//  computeApprovalOrder()
//    .then(updateOrderStatus);
//
//  // if order accepted
//  computeNextOrder()
//    .then(executeOrder)
//    .then(updateOrderStatus);
//});