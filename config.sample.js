/**
 * Configuration
 */
var config = {};

if(true) {
  // Secure config
  config.auth = {}; // used with request - keep object properties user and password!
  config.auth.user = 'foo';
  config.auth.password = 'bar';

  // REST
  config.rest = {};
  config.rest.host = 'https://foo.bar.xy';
  config.rest.getTasks = 'getTasks';
  config.rest.getOrdersByStatus = 'getOrdersByStatus';
  config.rest.updateOrderStatus = 'updateOrderStatus';
  config.rest.updateOrder = 'updateOrder';

  // OPC UA
  config.OPCUAOrder = 'opc.tcp://x.y.z.a:4840/';
}

// Run on localhost
if(true){
  config.auth.user = 'foo';
  config.auth.password = 'bar';

  config.rest.host = 'http://localhost:3001';

  config.OPCUAOrder = 'opc.tcp://localhost:4840/';
}

module.exports = config;