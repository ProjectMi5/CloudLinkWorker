var config = require('./config.js');

var StateMachine = require('javascript-state-machine');
var _ = require('underscore');

var rest = require('./mi5-modules/rest');

// Create the orders state machine
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

var Worker = function(){
  this.simultaneous = 3;  // number of orders that should be produced simultaneously
  this.queue = 0;         // number of queued orders in production
  this.orders = [];       // complete collection of all orders to work on
};
Worker.prototype.queueHasPlace = function(){
  if(this.queue < this.simultaneous){
    return true;
  } else {
    return false;
  }
};
Worker.prototype.enqueueOrder = function(order){
  if(this.queueHasPlace()){
    this.queue = this.queue + 1;
  }
};
Worker.prototype.dequeOrder = function(order){
  this.queue = this.queue - 1;
};
Worker.prototype.addOrder = function(order){
  this.orders.push(order);
};
Worker.prototype.getAllOrderIds = function(){
  var orders = _.pluck(this.orders, 'order');
  return _.pluck(orders, 'orderId');
}
var CLW = new Worker(); // CloudLinkWorker

rest.getOrdersByStatus('pending')
  .then(function (orders) {
    orders.forEach(function(order){
      var order = new OrderSM(order);
      CLW.addOrder(order);
    });

    console.log(CLW.getAllOrderIds());
  });
