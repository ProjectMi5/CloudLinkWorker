var _ = require('underscore');
var Promise = require('bluebird');

/**
 * Worker instance
 * @constructor
 *
 * Every promise need to have correct context. Use: new Promise().bind(Worker[/this])
 * More information:
 * http://stackoverflow.com/questions/26056188/elegant-callback-binding-when-using-promises-and-prototypes-in-javascript
 * also google: bind context promise
 */
var Worker = function(){
  this.config = require('./config.js');
  this.rest = require('./mi5-modules/rest');

  this._simultaneous = 3;  // number of orders that should be produced simultaneously
  this._queue = 0;         // number of queued orders in production
  this._orders = [];       // collection of all OrderSM to work on
};
var moment = require('moment');


/**
 * compute which order is next
 *
 * order of execution
 *  marketPlaceId: eu
 *  priority
 *  orderId (implicit) (lowest orderId first)
 */
Worker.prototype.computeNextOrder = function(){
  var deferred = Promise.pending();
  deferred.promise.bind(this);

  var orders = this._orders;
  if(_.isEmpty(orders)){
    deferred.reject('OrderListIsEmpty');
    return deferred.promise;
  }

  // Sort by orderId first, so implicit order is given
  orders = _.sortBy(orders, 'orderId');
  orders = _.sortBy(orders, 'priority');

  // Look for eu orders and return first element
  var euOrders = _.filter(orders, function(order){
      if(order.marketPlaceId == 'eu'){
        return true; //sorting function
      }
    });
  if(!_.isEmpty(euOrders)){
    deferred.resolve(euOrders.shift()); // return top element
    return deferred.promise;
  }

  // Get highest priority
  if(!_.isEmpty(orders)){
    deferred.resolve(orders.shift()); // return top element
    return deferred.promise;
  }
};

Worker.prototype.getPendingOrders = function(){
  return this.rest.getOrdersByStatus('pending').bind(this);
};

Worker.prototype.getAcceptedOrders = function(){
  return this.rest.getOrdersByStatus('accepted').bind(this);
};

Worker.prototype.manageIncomingOrdersArray = function(orders){
  if(!_.isArray(orders)){
    throw new Error('orders is not an array');
  }

  // TODO: Only add order if it does not exist
  var self = this;
  self._orders = []; //clean orders array for new complete list
  _.each(orders, function(order){
    self._orders.push(order);
  });

  return new Promise(function(res){res();}); // 'void' Promises do not need .bind(this);
};

Worker.prototype.executeOrder = function(order){
  var deferred = Promise.pending();
  deferred.promise.bind(this);

  var simpleRecipeInterface = require('./mi5-modules/simpleRecipeInterface');

  var opcuaOrder = {
    Pending : true,
    RecipeID : order.recipeId,
    TaskID : order.orderId,
  };

  var userparameters = _.map(order.parameters, function(val){ return {Value: val};});

  simpleRecipeInterface.setOrder(opcuaOrder, userparameters, function(err){
    if(err){
      console.log('setOrder Err', err);
      deferred.reject(err);
    } else {
      deferred.resolve(order);
    }
  });
  return deferred.promise;
};

Worker.prototype.wait = function(){
  //console.log('INFO: wait 2s');
  var deferred = Promise.pending();
  deferred.promise.bind(this);
  setTimeout(function(){
    deferred.resolve();
  },2000);
  return deferred.promise;
};

Worker.prototype.setInProgressToOrder = function(order){
  console.log('INFO: updating status order ', order.orderId, ' from "'+order.status+'" to: "in progress"');
  return this.rest.updateOrderStatus(order.orderId, 'in progress').bind(this);
};

Worker.prototype.acceptOrder = function(order, timeUntilCompletion){
  var update = {
    orderId: order.orderId,
    estimatedTimeOfCompletion: timeUntilCompletion,
    status: 'accepted'
  };
  console.log('INFO: perform update:', update);
  return this.rest.updateOrder(update).bind(this);
};

/**
 * Compute time until completion
 *
 * nr_of_accepted_orders * 90s + 180s production = time until production
 *
 * Estimation that every order takes 90s.
 * @param order
 * @returns {*}
 */
Worker.prototype.computeTimeUntilCompletion = function(order){
  var self = this;
  return this.getAcceptedOrders()
    .then(function(orders){
      var timeUntilProduction = moment().add(orders.length * 90,'s');
      var timeUntilCompletion = timeUntilProduction.add(180,'s');

      var formattedTime = moment(timeUntilCompletion, 'YYYY-MM-DD[T]HH:mm:ss').format();
      return new Promise.resolve([order, formattedTime]).bind(self);
    });
};

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