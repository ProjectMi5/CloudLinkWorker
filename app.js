var config = require('./config.js');

var StateMachine = require('javascript-state-machine');
var _ = require('underscore');

var rest = require('./mi5-modules/rest');

///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * State Machine factory for one CloudLink order
 * @constructor
 */
var OrderSM = function(order){
  this.startup();
  this.order = order;
};
var OrderStates = {
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
        to: 'failure' }
  ]};
StateMachine.create(OrderStates);

///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Worker instance
 * @constructor
 */
var Worker = function(){
  this.startup();         // startup for state machine
  this.simultaneous = 3;  // number of orders that should be produced simultaneously
  this.queue = 0;         // number of queued orders in production
  this.orders = [];       // collection of all OrderSM to work on
  this.ordersQueue = [];  // collection of all OrderSM that are queued
};
Worker.prototype._queueHasPlace = function(){
  return this.queue < this.simultaneous;
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
    this.ordersQueue = _.reject(this.ordersQueue, function(item){
        return item.order.orderId == orderid;
    });
  }
};
Worker.prototype.manageOrder = function(order){
  this.orders.push(order);
};
Worker.prototype.getAllOrderIds = function(){
  var orders = _.pluck(this.orders, 'order');
  return _.pluck(orders, 'orderId'); // array
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
  var pureOrders = _.pluck(this.orders, 'order');

  // Sort by orderId first, so implicit order is given
  pureOrders = _.sortBy(pureOrders, 'orderId');
  pureOrders = _.sortBy(pureOrders, 'priority');

  // Look for eu orders and return first element
  var euOrders = _.filter(pureOrders, function(order){
      if(order.marketPlaceId == 'eu'){
        return true;
      }
    });
  if(!_.isEmpty(euOrders)){
    return this._extractOrderId(euOrders.shift());
  }

  // Get highest priority
  if(!_.isEmpty(pureOrders)){
    return this._extractOrderId(pureOrders.shift());
  }
};
Worker.prototype._extractOrderId = function(order){
  try{
    return order.orderId;
  } catch (err){
    console.log('the given object is not an order or does not have the element orderId on the first level', err);
  }
};

///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////

Worker.prototype.onupdate = function(event, from, to) {
  console.log('updating');
};
Worker.prototype.onleaveupdating = function(){
  var self = this;
  console.log('onleaveupdating');
  setTimeout(function(){
    console.log('updateprocess finished after 1000ms');
    self.transition();
  }, 1000);
  return StateMachine.ASYNC;
};
Worker.prototype.onworking = function(event, from, to) {
  console.log('onworking');
  this.idle();
};
Worker.prototype.onidling = function(event, from, to) {
  console.log('onidling.... lalala');
};
Worker.prototype.onterminate = function(){
  // exit application
  console.log('onterminate');
};


/**
 * Create worker state machine
 * @type {{target: (Object|Worker), events: *[]}}
 */
var WorkerStates = {
  target: Worker.prototype,
  error: function(eventName, from, to, args, errorCode, errorMessage) {
    return 'event ' + eventName + ' was naughty :- ' + errorMessage;
  },
  events: [
    {name: 'startup', from: 'none', to: 'idling' },
    {name: 'update', from: '*', to: 'updating' },
    {name: 'work', from: '*', to: 'working' },
    {name: 'idle', from: 'updating', to: 'idling' },
    {name: 'terminate', from: '*', to: 'terminating' }
  ]
};
StateMachine.create(WorkerStates);

var CLW = new Worker();

///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Program logic and testing functions
 */
try {
    CLW.update();
    CLW.work();
    CLW.idle();
    CLW.work();
    CLW.update();
    CLW.work();
    CLW.idle();
    CLW.update();
    CLW.work();
} catch(err){
  console.log(err);
}

setInterval(function(){
  console.log('alive....');
},5000);

//rest.getOrdersByStatus('pending')
//  .then(function (orders) {
//    orders.forEach(function(order){
//      console.log('marketplaceid:', order.marketPlaceId, 'prio:', order.priority, 'orderId', order.orderId);
//      order = new OrderSM(order);
//      CLW.manageOrder(order);
//
//      if(order.order.orderId == 2437) {
//        CLW.enqueueOrder(order);
//      }
//
//      if(order.order.orderId == 2442) {
//        CLW.enqueueOrder(order);
//      }
//    });
//
//    console.log(CLW.getAllOrderIds());
//    console.log(CLW.ordersQueue);
//    console.log('queue size:', CLW.queue);
//    CLW.dequeOrder(2442);
//    console.log(CLW.ordersQueue);
//    console.log('queue size:', CLW.queue);
//
//    console.log(CLW.computeNextOrder());
//  });
//
