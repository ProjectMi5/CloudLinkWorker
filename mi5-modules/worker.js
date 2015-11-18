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
  this.config = require('./../config.js');
  this.rest = require('./rest');

  this._simultaneous = 3;  // number of orders that should be produced simultaneously
  this._queue = 0;         // number of queued orders in production
  this._orders = [];       // collection of all OrderSM to work on
};
module.exports = Worker;
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

  var simpleRecipeInterface = require('./simpleRecipeInterface');

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

