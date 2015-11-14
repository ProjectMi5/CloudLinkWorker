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
Worker.prototype.manageIncomingOrdersArray = function(orders){
  if(!_.isArray(orders)){
    throw new Error('orders is not an array');
  }

  // TODO: Only add order if it does not exist
  var self = this;
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

  simpleRecipeInterface.setOrder(opcuaOrder, order.parameters, deferred.resolve);
  return deferred.promise;
};

/**
 * Execute accepted orders
 * -----------------------
 * Get every minute a complete list
 * (in addition to mqtt, since it might be possible due to connection problems, that we miss some?)
 */
Worker.prototype.executeAcceptedOrders = function() {
  var self = this;
  self.getPendingOrders()
    .then(self.manageIncomingOrdersArray)
    .then(self.computeNextOrder)
    //.then(console.log)
    .then(self.executeOrder)
    .then(function(err, res){
      console.log(err, res);
      console.log('order was probably executed');
    })
    //.then(self.updateOrderStatus)

    .catch(function(err){
      console.log('ERROR',err);
    });
};

///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////

var CLW = new Worker(); // CloudLinkWorker
CLW.executeAcceptedOrders();
//setInterval(executeAcceptedOrders, 60*1000);

///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Accept orders
 * -----------------------
 * Get every minute a complete list
 */
//setInterval(function(){
//  rest.getOrdersByStatus('pending')
//    .then(computeApprovalOrder)
//    .then(updateOrderStatus);
//}, 60*1000);

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