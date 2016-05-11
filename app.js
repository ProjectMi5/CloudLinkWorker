var _ = require('underscore');
var Promise = require('bluebird');

var Worker = require('./mi5-modules/worker');

Worker.prototype.accept = function(){
  var self = this;
  var maxOrdersProcessing = this.config.processing.maxOrdersProcessing;

  return Promise.all([self.getInProgressOrders(), 
        self.getPendingOrders()
        .then(self.filterOrdersAccordingConfig)])
  .spread(function(ordersInProgress,filteredOrders){
	  var promise;
      if (ordersInProgress.length < maxOrdersProcessing && filteredOrders.length>0) {
    	  
    	  console.log("Accepting one order.");
          promise = self.getPendingOrders()
          
          .then(self.selectOneOrderByIncomingOrder)
          .then(self.computeTimeUntilCompletion)
          .spread(self.acceptOrder)
          .catch(TypeError, function (err) {
            console.log('catchedTypeError', err);
          })
          .catch(function (err) {
            console.log('error accepting orders: ', err);
          });
      }
      else if (filteredOrders.length<=0){
          console.log("No orders to accept... waiting");
          promise = Promise.resolve();
      }
      else {
          console.log("Already "+ ordersInProgress.length +" orders in progress... waiting");
          promise = Promise.resolve();
      }
      
        return promise;
  }) // spread
  .delay(1000)
  .then(function(){
    return self.accept();
  })
  .catch(function(err){
	  console.log("Error in accept: " +err);
  });
}; // accept


Worker.prototype.execute = function(){
  var self = this;
  return self.getAcceptedOrders()
    .then(self.selectOneOrderByIncomingOrder)
    .then(function(order){
      return Promise.all([
        self.setInProgressToOrder(order),
        self.executeOrder(order)
        ]);
    })
    .then(function(results){
      console.log('afterSetInProgress and after execute:', results);
    })
    .catch(TypeError, function(err){
      console.log('catchedTypeError', err);
    })
    .catch(function(err){
      console.log('error', err);
    })
    .delay(1000)
    .then(function(){
      return self.execute();
    });
}

///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////

var CLW = new Worker(); // CloudLinkWorker
CLW.accept();
CLW.execute();
