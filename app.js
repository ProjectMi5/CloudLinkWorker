var _ = require('underscore');
var Promise = require('bluebird');

var Worker = require('./mi5-modules/worker');

Worker.prototype.accept = function(){
  var self = this;
  var maxOrdersProcessing = this.config.processing.maxOrdersProcessing;

  return self.getInProgressOrders()
      .then(function(ordersInProgress) {
        var promise;
        if (ordersInProgress.length < maxOrdersProcessing) {
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
        else {
          console.log("Orders in queue: " + ordersInProgress.length + " ... waiting");
          promise = Promise.resolve();
        }
        return promise;
      })
      .delay(1000)
      .then(function(){
        return self.accept();
      });
};

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
