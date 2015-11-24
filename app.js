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
      if(order.marketPlaceId == 'centigrade'){
        console.log('INFO: we do not execute centigrade right away. Set Status to "done" manually and execute on site');
        throw new Error('CentigradeOrder');
      }
      console.log('INFO: execute Accepted Orders Next order will be:', order);
      return order;
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
      console.log('some error: ', err);
      if(err == 'OrderListIsEmpty'){
        // nothing
      } else if (err.Error.CentigradeOrder){
        // do not execute centigrade orders
        console.log('centigrade order will not be processed');
      }
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
      return order;
    })
    // Compute time until production
    .then(self.computeTimeUntilCompletion)
    .spread(self.acceptOrder)
    .then(function(){
      console.log('SUCCESS: order is now in accepted');
    })
    .catch(function(err){
      if(err == 'OrderListIsEmpty'){

      } else if(err == 'TaskListIsFull'){
        console.log('we only accept 3 orders simultaneously');
      }
      else {
        console.log('ERROR',err);
      }
    });
};

Worker.prototype.executeCentigradeOrdersInProgress = function() {
  var self = this;
  return self.getInProgressOrders()
    .then(self.filterForCentigradeOrders)
    .then(self.selectOneOrderByIncomingOrder)
    .then(self.executeOrder)
    .then(function(order) {
      console.log('INFO: a centigrade order was executed');
      return self.setDoneToOrder(order);
    })
    .then(function(){
      console.log('INFO: centigrade order is now in progress');
    })
    .catch('TypeError', function(e){
      console.log('juhu typeerror');
    })
    .catch(function(err){
      if(err == 'OrderListIsEmpty'){
        // nothing
      } else {

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
    .delay(3000)
    .then(function(){
      return self.run();
    });
};

Worker.prototype.runAccept = function(){
  var self = this;
  return self.acceptPendingOrders()
    .delay(3000)
    .then(function(){
      return self.runAccept();
    });
};

Worker.prototype.runCentigrade = function(){
  var self = this;
  return self.executeCentigradeOrdersInProgress()
    .delay(3000)
    .then(function(){
      return self.runCentigrade();
    });
};

///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////

var CLW = new Worker(); // CloudLinkWorker
console.log('CloudLinkWorker running');

console.log('* executing orders');
CLW.run();

console.log('* accepting all orders that are in progress');
CLW.runAccept();

console.log('* execute manulay set to "in progress" centigrade orders');
//CLW.runCentigrade();

///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Listen to changes via MQTT
 * not yet implemented
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