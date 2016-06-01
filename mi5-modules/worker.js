var _ = require('underscore');
var Promise = require('bluebird');
var MI5REST = require('cloudlinkrest');
var moment = require('moment');

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
  this.rest = new MI5REST(this.config.rest.host, this.config.auth.user, this.config.auth.password);

  this._orders = [];       // collection of all OrderSM to work on
};
module.exports = Worker;

/**
 * Return pending orders, with blacklisted orderIds (see config) removed
 */
Worker.prototype.getPendingOrders = function(){
    var promise = this.rest.getOrdersByStatus("pending").bind(this);
    var blacklistOrderIds = this.config.processing.blacklistOrderIds;
    return promise.then(function(orders)
		{
	    	return _.filter(orders,function(obj){
	    		return !_.contains(blacklistOrderIds,obj.orderId);
	    	});
		});
};

/**
 * Return accepted orders, with blacklisted orderIds (see config) removed
 */
Worker.prototype.getAcceptedOrders = function(){
    var promise = this.rest.getOrdersByStatus("accepted").bind(this);
    var blacklistOrderIds = this.config.processing.blacklistOrderIds;
    return promise.then(function(orders)
    		{
    	    	return _.filter(orders,function(obj){
    	    		return !_.contains(blacklistOrderIds,obj.orderId);
    	    	});
    		});
};

/**
 * Return orders in progress, with blacklisted orderIds (see config) removed
 */
Worker.prototype.getInProgressOrders = function(){
    var blacklistOrderIds = this.config.processing.blacklistOrderIds;
    return this.rest.getOrdersByStatus("in progress").bind(this)
	    .then(function(orders){
	    	return new Promise.resolve(_.filter(orders,function(obj){
	    		return !_.contains(blacklistOrderIds,obj.orderId);
	    	}));
		});  
};

/**
 * Returns orders to be processed filtered according to the config file (config.processing)
 * @param orders {JSON} Order array
 */
Worker.prototype.filterOrdersAccordingConfig = function(orders){
  var marketplace = this.config.processing.marketplace;
  var acceptOrdersSince = this.config.processing.acceptOrdersSince;
  var dateFormat = this.config.rest.dateFormat;
  var deferred = Promise.pending();
  deferred.promise.bind(this);

  // Filter orders according to marketplace
  var orders_filtered = _.filter(orders, function(order){
      var acceptedMarketplace =  _.contains(marketplace,order.marketPlaceId);
      var acceptedDate = moment(order.date,dateFormat).isAfter(acceptOrdersSince,'second');
      return acceptedMarketplace && acceptedDate;  
  });

  deferred.resolve(orders_filtered);
  return deferred.promise;
};


Worker.prototype.filterForCentigradeOrders = function(orders) {
  if (!_.isArray(orders)) {
    throw new Error('orders is not an array');
  }

  return new Promise(function(res){ res(_.where(orders, {marketPlaceId: 'centigrade'}))});
};

Worker.prototype.selectOneOrderByIncomingOrder = function(orders){
  return new Promise(function(res){ res(orders.pop()); });
};

Worker.prototype.rejectOrder = function(order){
  return this.rest.updateOrderStatus(order.orderId, failure).bind(this);
};

Worker.prototype.executeOrder = function(order){
  var self = this;
  var deferred = Promise.pending();
  deferred.promise.bind(this);

  // Do not Execute Centigrade orders on the machine! but make a timeout of 30' to set it done
  if(order.marketPlaceId == 'centigrade'){
    deferred.resolve({status: 'ok', description: 'centigrade order is not executed, but its all fine'});

    // set timer to report it done
    setTimeout(function(){
      self.setDoneToOrder(order);
    },30*60*1000); // 30 minutes

    return deferred.promise;
  } else {
    var simpleRecipeInterface = require('./simpleRecipeInterface');

    var opcuaOrder = {
      Pending: true,
      RecipeID: order.recipeId,
      TaskID: order.orderId
    };

    var userparameters = _.map(order.parameters, function (val) {
      return {Value: val};
    });

    simpleRecipeInterface.setOrder(opcuaOrder, userparameters, function (err) {
      if (err) {
        console.log('setOrder Err', err);
        deferred.reject(err);
      } else {
        deferred.resolve(order);
      }
    });
    return deferred.promise;
  }
};

Worker.prototype.setInProgressToOrder = function(order){
  console.log('INFO: updating status order ', order.orderId, ' from "'+order.status+'" to: "in progress"');
  return this.rest.updateOrderStatus(order.orderId, 'in progress').bind(this);
};

Worker.prototype.setDoneToOrder = function(order){
  console.log('INFO: set "done" to ', order.orderId);
  return this.rest.updateOrderStatus(order.orderId, 'done').bind(this);
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
  
  /*
  Promise.all([self.getInProgressOrders(),
               self.getAcceptedOrders(),
               self.getPendingOrders()
               .then(self.filterOrdersAccordingConfig)])
           .spread(function(ordersInProgress,acceptedOrders,filteredOrders){
  */
  
  return Promise.all([this.getInProgressOrders(),this.getAcceptedOrders()])
    .spread(function(inProgressOrders,acceptedOrders){
      var timeUntilCompletion;
      var numOrders = inProgressOrders.length + acceptedOrders.length;
      if(order.marketPlaceId == 'eu'){
        timeUntilCompletion = moment().add(3,'m').utc().format();
      }
      else if (order.marketPlaceId == 'itq') {
        timeUntilCompletion = moment().add(numOrders * 2,'m'); // 2 min for every order that is in production
        timeUntilCompletion = timeUntilCompletion.add(3,'m'); // 3 min base delay

        timeUntilCompletion = timeUntilCompletion.utc().format();
      }
      else if (order.marketPlaceId == 'centigrade') {
        timeUntilCompletion = moment().add(numOrders* 2,'m'); // 2 min for every order that is in production
        timeUntilCompletion = timeUntilCompletion.add(3,'m'); // 3 min base delay

        // Orders from centigrade will have a 30' delay (since people need to walk over)
        timeUntilCompletion = timeUntilCompletion.add(30,'m');

        timeUntilCompletion = timeUntilCompletion.utc().format();
      }
      else {
        // should not be here
        timeUntilCompletion = moment().add(1, 'd').utc().format();
      }
      return new Promise.resolve([order, timeUntilCompletion]).bind(self);
    });
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
    deferred.reject('OrderListIsEmpty');
    return deferred.promise;
  }

  // Sort by orderId first, so implicit order is given
  orders = _.sortBy(orders, 'orderId');
  orders = _.sortBy(orders, 'priority');

  // Sorting: Generate array for eu orders
  var euOrders = _.filter(orders, function(order){
    if(order.marketPlaceId == 'eu'){
      return true; //sorting function
    }
  });

  // Return a eu order if there is one
  if(!_.isEmpty(euOrders)){
    deferred.resolve(euOrders.shift()); // return top element
    return deferred.promise;
  }

  // Otherwise: Get highest priority but never produce centigrade orders directly
  if(!_.isEmpty(orders)){
    deferred.resolve(orders.shift()); // return top element
    return deferred.promise;
  }
};
