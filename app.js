var config = require('./config.js');

var StateMachine = require('javascript-state-machine');
var _ = require('underscore');

var rest = require('./mi5-modules/rest');

/**
 * State Machine factory for one CloudLink order
 * @constructor
 */
var OrderSM = function(order){
  this.startup();
  this.order = order;
};
var orderStateMachine = {
  target: OrderSM.prototype,
  events: [
    { name: 'startup', from: 'none',   to: 'pending' },
    { name: 'accept',   from: 'pending',      to: 'accepted' },
    { name: 'produce',  from: 'accepted',     to: 'inprogress' },
    { name: 'finish',   from: 'inprogress',  to: 'done' },
    { name: 'deliver',  from: 'done',         to: 'delivered' },
    { name: 'archive',
        from: ['rejected', 'delivered', 'failure', 'aborted'],
        to: 'archived' },
    { name: 'reject',   from: 'pending',      to: 'rejected' },
    { name: 'abort',    from: ['pending', 'accepted'], to: 'aborted' },
    { name: 'fail',     from: ['inprogress', 'done', 'delivered'],
        to: 'failure' },
  ]};
StateMachine.create(orderStateMachine);

/**
 * Mange Orders
 * @constructor
 */
var Worker = function(){
  this.simultaneous = 3;  // number of orders that should be produced simultaneously
  this.queue = 0;         // number of queued orders in production
  this.orders = [];       // collection of all OrderSM to work on
  this.ordersQueue = [];  // collection of all OrderSM that are queued
};
Worker.prototype._queueHasPlace = function(){
  if(this.queue < this.simultaneous){
    return true;
  } else {
    return false;
  }
};
Worker.prototype.enqueueOrder = function(order){
  if(this._queueHasPlace()){
    this.queue = this.queue + 1;
    this.ordersQueue.push(order);
  }
};
Worker.prototype.dequeOrder = function(orderid){
  if(_.contains(this.getAllOrderIds(), orderid)){
    this.queue = this.queue - 1;
    // remove the order from this.orders array
    this.ordersQueue = _.reject(this.ordersQueue, function(order){ return order.orderId == orderid; });
  }
};
Worker.prototype.manageOrder = function(order){
  this.orders.push(order);
};
Worker.prototype.getAllOrderIds = function(){
  var orders = _.pluck(this.orders, 'order');
  return _.pluck(orders, 'orderId'); // array
};
var CLW = new Worker(); // CloudLinkWorker

/**
 * Program logic and testing functions
 */
rest.getOrdersByStatus('pending')
  .then(function (orders) {
    orders.forEach(function(order){
      var order = new OrderSM(order);
      CLW.manageOrder(order);

      if(order.order.orderId == 2437) {
        CLW.enqueueOrder(order);
      }
    });

    console.log(CLW.getAllOrderIds());
    console.log(CLW.ordersQueue);
  });
