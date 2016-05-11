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
  config.rest.dateFormat = 'YYYY-MM-DD[T]HH:mm:ss';

  // OPC UA
  config.OPCUAOrder = 'opc.tcp://x.y.z.a:4840/';

  // Order processing rules
  config.processing = {};
  config.processing.marketplace = ['mi5','itq'];
  config.processing.maxOrdersProcessing =  500;
}

// Run all on localhost
if(process.env.TEST){
  console.log('TEST set');
  config.auth = {};
  config.auth.user = 'foo';
  config.auth.password = 'bar';

  config.rest.host = 'http://localhost:3001';

  config.OPCUAOrder = 'opc.tcp://localhost:4334/';
}

// only recipe module mock
if(process.env.USENODEMODULE){
  console.log('USENODEMODULE set');
  config.OPCUAOrder = 'opc.tcp://localhost:4334/';
}

module.exports = config;