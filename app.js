var _ = require('underscore');
var Promise = require('bluebird');

var Worker = require('./mi5-modules/worker');

Worker.prototype.accept = function(){
  var self = this;

  return Promise.all([self.getInProgressOrders(),
                      self.getAcceptedOrders(),
                      self.getPendingOrders()
                      .then(self.filterOrdersAccordingConfig)])
                  .spread(function(ordersInProgress,acceptedOrders,filteredOrders){
	  var promise;
      if (filteredOrders.length>0){ //(ordersInProgress.length + acceptedOrders.length) < maxOrdersProcessing && filteredOrders.length>0){          	  
    	  console.log("Accepting one order.");
          promise = self.getPendingOrders() 
    	  .then(self.filterOrdersAccordingConfig)
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
      else{
          console.log("No orders to accept... waiting");
          promise = Promise.resolve();
      }
      
        return promise;
  }) // spread
  .catch(function(err){
	  console.log("Error in accept: " +err);
  })
  .delay(1000)
  .then(function(){
    return self.accept();
  });
}; // accept


Worker.prototype.execute = function(){
	var self = this;
	var maxOrdersProcessing = this.config.processing.maxOrdersProcessing;

	return Promise.all([self.getInProgressOrders(),
	                    self.getAcceptedOrders()])
	    .spread(function(ordersInProgress,acceptedOrders){
	        var promise;
	        if (acceptedOrders.length>0 && ordersInProgress.length<maxOrdersProcessing){          	  
	            // Execute order
	            promise = self.selectOneOrderByIncomingOrder(acceptedOrders)
	            .then(function(order){
	            	console.log("Setting order " + order.orderId + " in progress.");
	                return Promise.all([
	                self.setInProgressToOrder(order),
	                self.executeOrder(order)]);
	                })
	                .then(function(results){
	                console.log('afterSetInProgress and after execute:', results);
	            });
	        }
	        else if (acceptedOrders.length>0){
	        	console.log("Already " + ordersInProgress.length + " orders in progress... waiting");
	        	promise = Promise.resolve();
	        }
	        else {
	            // No order to be executed
	            console.log("No order to be executed... waiting");
	            promise = Promise.resolve();
	        }
	        return promise;
	    })
	    .catch(TypeError, function(err){
	      console.log('Execute: CatchedTypeError', err);
	    })
	    .catch(function(err){
	      console.log('Execute: Error', err);
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
