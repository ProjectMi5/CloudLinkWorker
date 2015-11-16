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
    throw new Error('order list is empty - nothing to process');
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

  simpleRecipeInterface.setOrder(opcuaOrder, order.parameters, function(err){
    if(err){
      deferred.reject(err);
    } else {
      deferred.resolve({status: 'ok'});
    }
  });
  return deferred.promise;
};

Worker.prototype.wait = function(){
  console.log('INFO: wait 2s');
  var deferred = Promise.pending();
  deferred.promise.bind(this);
  setTimeout(function(){
    deferred.resolve();
  },2000);
  return deferred.promise;
};

Worker.prototype.setInProgressToOrder = function(order){
  console.log('INFO: updating status order ', order.orderId, ' from "',order.status,'" to: "in progress"');
  return this.rest.updateOrderStatus(order.orderId, 'in progress').bind(this);
};

Worker.prototype.setAcceptedToOrder = function(order){
  console.log('INFO: updating status order ', order.orderId, ' from "',order.status,'" to: "accepted"');
  return this.rest.updateOrderStatus(order.orderId, 'accepted').bind(this);
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
      console.log('ERROR',err);
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
  var currentOrder;
  return self.getPendingOrders()
    .then(self.manageIncomingOrdersArray)
    .then(self.computeNextOrder)
    .then(function(order){
      currentOrder = order;
      console.log('INFO: Next ordre to accept', order);
      return new Promise(function(res){res(order);}).bind(self); // continue the promise chain with the order
    })
    .then(function() {
      console.log('INFO: set state to accepted');
      return self.setAcceptedToOrder(currentOrder);
    })
    .then(function(){
      console.log('INFO: order is now in accepted');
    })

    .catch(function(err){
      console.log('ERROR',err);
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
      console.log('INFO: resursive call to Worker.run()');
      return self.run();
    });
};

Worker.prototype.runAccept = function(){
  var self = this;
  return self.acceptPendingOrders()
    .then(self.wait)
    .then(function(){
      console.log('INFO: resursive call to Worker.runAccept()');
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