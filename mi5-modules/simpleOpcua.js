var _ = require('underscore');
var assert = require('assert');

/**
 * OPC UA Model simplified
 * 
 * @author Thomas Frei
 * @date 2014-11-04
 */

exports.server = function(endPointUrl) {

  var nodeopcua = require("node-opcua");
  var util = require("util");
  var events = require("events");
  var async = require("async");
  var md5 = require("md5");

  /*
   * OpcUA object to handle scope-issues of nested cb calls
   */
  var opcua;

  // Define opc(totype) function as a class (using util.js)
  opc = (function() {
    // ctor
    function opc() {
      this.opcuaObject = 1;
      this.client = undefined;
      this.session = undefined;
      this.subscription = undefined;
    }

    opc.prototype = {
      constructor : opc,

      /**
       * initialize OPC UA connection and create session
       * 
       * @param initializeCallback
       */
      initialize : function(initializeCallback) {
        async.series([ function(callback) {
          // only create Client, if there is none
          if (true) {
            // if (typeof opcua.client === 'undefined') {
            // secureChannel handling
            // error
            opcua.client = new nodeopcua.OPCUAClient();
            opcua.client.connect(endPointUrl, function(err) {
              callback(err);
            });
          } else {
            callback();
          }
        }, function(callback) {
          // Only create session, if there is none
          if (true) {
            // if (typeof opcua.session === 'undefined') {
            // SessionHandling! if so,
            // secureChannel handling error
            opcua.client.createSession(function(err, session) {
              opcua.session = session;
              callback(err);
            });
          } else {
            callback();
          }
        } ], function(err) {
          opcua.emit('err', err);
          initializeCallback(err);
        });
      },

      /**
       * Disconnect
       * 
       * @param callback
       *          <function> optional
       * @async
       */
      disconnect : function(callback) {
        if (typeof opcua.client !== 'undefined') {
          // // Terminate Subscriptions
          // if (typeof opcua.subscription !== 'undefined') {
          // opcua.subscription.terminate();
          // }
          // Terminate Sessions
          // if (typeof opcua.session !== 'undefined') {
          // opcua.session.close();
          // }
          if (callback) {
            opcua.client.disconnect(callback);
          } else {
            opcua.client.disconnect(function(err) {
              if (err) {
                console.log(err);
              }
            });
          }
        }
      },

      /**
       * Create subscription
       * 
       * @async
       * @param callback
       */
      mi5Subscribe : function() {
        var subscriptionSettings = {
          requestedPublishingInterval : 1000,
          requestedLifetimeCount : 100, // 10 // if not present, subscribtion
                                        // gets terminated soon.
          requestedMaxKeepAliveCount : 10, // 2
          maxNotificationsPerPublish : 10,
          publishingEnabled : true,
          priority : 10
        };
        opcua.subscription = new nodeopcua.ClientSubscription(opcua.session,
            subscriptionSettings);

        opcua.subscription.on("started", function() {
          console.log("mi5Subscribe: subscription started - subscriptionId=",
              opcua.subscription.subscriptionId);
        });
        opcua.subscription.on("keepalive", function() {
          // console.log('SUBS: keepalive');
        }).on("terminated", function() {
          console.log('SUBS: terminated');
        });
      },

      /**
       * Add a monitored item. Gives back object for monitored item (with event
       * listeners)
       * 
       * @param nodeIdToMonitor
       *          (e.g. MI5.MessageFeed.MessageFeed[1])
       * @return Object
       */
      mi5Monitor : function(nodeIdToMonitor) {
        nodeIdToMonitor = opcua._checkNodeId(nodeIdToMonitor);

        var itemToMonitor = {
          nodeId : nodeopcua.resolveNodeId(nodeIdToMonitor),
          attributeId : 13
        };
        var requestedParameters = {
          samplingInterval : 100,
          discardOldest : true,
          queueSize : 10
        };
        var timestampToReturn = nodeopcua.read_service.TimestampsToReturn.Both;

        var monitoredNode = opcua.subscription.monitor(itemToMonitor,
            requestedParameters, timestampToReturn);

        return monitoredNode;
      },

      /**
       * Read an array with custom callback function
       * 
       * @async
       */
      mi5ReadArray : function(nodeIdArrayToRead, callback) {
        var max_age = 0, nodes = opcua
            ._addNamespaceAndAttributeIdToNodeId(nodeIdArrayToRead);
        // console.log('OK - ReadArray Called');
        opcua.session.read(nodes, max_age, function(err, nodes, results) {
          var tempData = opcua._concatNodesAndResults(nodes, results);
          tempData = opcua._addEventsAndIdsToResultsArray(tempData);
          // console.log(tempData);
          callback(err, tempData);
        });
      },

      /**
       * write an object (key:value) to opcua; mappingFunction required
       * 
       * @async
       * @param baseNode
       *          <string> MI5.Module2402Manual
       * @param object
       *          <object> {Execute: true}
       * @param mappingFunction
       *          <function> func(Execute) = 'Boolean'
       * @param callback
       *          <function>
       */
      mi5WriteObject : function(baseNode, object, mappingFunction, callback) {
        var mapping = require('./simpleDataTypeMapping');

        // handle object
        assert(_.isObject(object));
        var nodeData = opcua._convertMi5ListToNodeData(baseNode, object,
            mappingFunction);

        // write
        opcua.session.write(nodeData, function(err, result) {
          // Error occured
          if (result[0].value !== 0) {
            console.log(JSON.stringify(nodeData, null, 1), result);
          }
          callback(err, result);
        });
      },

      /**
       * Writes an order
       * 
       * 
       * @async
       * @param baseNode
       *          (e.g. 'MI5.Order[X]')
       * @param order
       *          <object> (e.g. {Name: 'Schnaps', Description: 'Das ist
       *          "eetwas"'})
       * @param userParameter
       *          <array> (e.g. [{Value: 16}, {Value: 1}]
       * @param callback
       * @callback callback(err)
       */
      mi5WriteOrder : function(baseNode, order, userParameters, callback) {
        var mapping = require('./simpleDataTypeMapping');
        var nodeDataArray = [];

        // handle Order
        assert(_.isObject(order));
        nodeDataArray.push(opcua._convertMi5ListToNodeData(baseNode, order,
            mapping.Mi5Order));

        // handle UserParameters
        assert(_.isArray(userParameters));
        assert(userParameters.length <= 6);
        for (var i = 0; i < userParameters.length; i++) {
          var userParameter = userParameters[i];
          var tempBaseNode = baseNode + '.UserParameter[' + i + '].';

          var nodeData = opcua._convertMi5ListToNodeData(tempBaseNode,
              userParameter, mapping.Mi5OrderUserParameter);
          nodeDataArray.push(nodeData);
        }
        // .push adds an array to an array => flatten one dimension
        nodeDataArray = _.flatten(nodeDataArray, true);

        opcua.session.write(nodeDataArray, callback);
      },

      /**
       * 
       * @param folder
       *          (e.g. 'ns=4;s=MI5')
       * @param callback(err,
       *          browseResults)
       */
      mi5Browse : function(folder, callback) {
        // example: folder = 'RootFolder'
        this.session.browse(folder, callback);
      },

      /**
       * convert list to an array of NodeData
       * 
       * If you use this function multiple times in a specific write method, you
       * need to use upper.push() with the return value of this function, and
       * then later flatten it again by one! (_.flatten(array,true);)
       * 
       * <pre>
       * var baseNode = 'ns=4;s=MI5.Order.0.';
       * var dataObject = {
       *   Name : 'hallo',
       *   Description : 'text',
       *   RecipeID : 123,
       *   Locked : true
       * };
       * </pre>
       * 
       * @needs opcua-Object
       * 
       * @param baseNode
       *          (e.g. 'MI5.Queue.Queue0')
       * @param list
       *          <object> {Name: 'hallo', Locked: true}
       * @param mapping
       *          <Function> Returns DataType for a VariableName
       * @returns {Array}
       * 
       */
      _convertMi5ListToNodeData : function(baseNode, list, mapping) {
        var nodeDataArray = new Array;
        baseNode = opcua._checkBaseNode(baseNode);

        _.keys(list).forEach(
            function(key) {
              nodeDataArray.push(opcua._structNodeData(baseNode + key,
                  list[key], mapping(key)));
            });

        // console.log(JSON.stringify(nodeDataArray, null, 1)); // debug
        return nodeDataArray;
      },

      /**
       * Creates a nodeData Struct for the array
       * 
       * @param nodeId
       *          <string> nodeId to value (e.g. MI5.Order[0].TaskID)
       * @param value
       *          <scalar> the value to write (e.g. "hallo", 1, 23, 2.5, true)
       * @param type
       *          <string> corresponding type (e.g. String, Int16, Int32, Float,
       *          Boolean)
       * @return <nodeData>
       */
      _structNodeData : function(nodeId, value, type) {
        assert(typeof nodeId === 'string');
        type = opcua._convertDataType(type);

        // NodeDataArrayEntry structure
        nodeData = {
          nodeId : nodeId,
          attributeId : 13,
          value : new nodeopcua.DataValue({
            value : new nodeopcua.Variant({
              dataType : type,
              value : value
            })
          })
        };

        return nodeData;
      },

      /**
       * returns Node-OPCUA Datatype according to normal datatype.
       * 
       * @param nodeId
       *          <string> nodeId to value (e.g. MI5.Order[0].TaskID)
       * @param value
       *          <scalar> the value to write (e.g. "hallo", 1, 23, 2.5, true)
       * @param type
       *          <string> corresponding type (e.g. String, Int16, Int32, Float,
       *          Boolean)
       * @return <nodeData>
       */
      _convertDataType : function(type) {
        assert(typeof type === 'string');
        // Match Datatypes:
        if (type === 'String') {
          type = nodeopcua.DataType.String;
        } else if (type === 'Double') {
          type = nodeopcua.DataType.Double
        } else if (type === 'Float') {
          type = nodeopcua.DataType.Float
        } else if (type === 'Int16') {
          type = nodeopcua.DataType.Int16
        } else if (type === 'UInt16') {
          type = nodeopcua.DataType.UInt16
        } else if (type === 'Boolean') {
          type = nodeopcua.DataType.Boolean
        } else {
          console.log('Datatype is not supported by simpleOpcua Model');
          assert(false); // TODO: nicer way
        }

        // NodeDataArrayEntry structure
        return type;
      },

      /**
       * Adds node-opcua specific nodes values: {nodeId} --> {nodeId:
       * 'ns=4;s='+node, attributeId: 13}
       * 
       * @param nodeIdArrayToRead
       *          array
       * @returns array
       */
      _addNamespaceAndAttributeIdToNodeId : function(nodeIdArrayToRead) {
        var output = _.map(nodeIdArrayToRead, function(node) {
          return {
            nodeId : opcua._checkNodeId(node),
            attributeId : 13
          };
        });
        return output;
      },

      /**
       * Check baseNode and adds stuff if necessary
       * 
       * @accepts 'MI5.Queue.Queue0.', 'ns=4;s=MI5.Queue.Queue0'
       * @param baseNode
       * @returns {String}
       */
      _checkBaseNode : function(baseNode) {
        // add . at the end if missing
        if (baseNode.slice(-1) != '.') {
          baseNode = baseNode + '.';
        }

        // check for namespace and node-identifier
        if (baseNode.slice(0, 7) != 'ns=4;s=') {
          baseNode = 'ns=4;s=' + baseNode;
        }

        return baseNode;
      },

      /**
       * Check NodeId and adds / removes stuff if necessary
       * 
       * @accepts 'MI5.Queue.Queue0.', 'ns=4;s=MI5.Queue.Queue0'
       * @param baseNode
       * @returns {String}
       */
      _checkNodeId : function(baseNode) {
        // add . at the end if missing
        if (baseNode.slice(-1) == '.') {
          baseNode = baseNode.slice(0, -1);
        }

        // check for namespace and node-identifier
        if (baseNode.slice(0, 7) != 'ns=4;s=') {
          baseNode = 'ns=4;s=' + baseNode;
        }

        return baseNode;
      },

      /*************************************************************************
       * Helper methods below
       */

      /**
       * Combines nodes and results to one data array with the structure:
       * [{"nodeId":"MI5.Module1101.Output.SkillOutput.SkillOutput0.Busy",
       * "value":0}, {...}, {...}]
       * 
       * @param nodes :
       *          nodeId
       * @param results :
       *          value
       * @returns {Array}
       */
      _concatNodesAndResults : function(nodes, results) {
        var output = new Array;
        for (var i = 0; i <= nodes.length; i++) {
          if (nodes[i] != undefined && results[i] != undefined) {
            // Check for BadNodeId (value: null, then statusCode)
            // console.log(nodes[i]);
            // console.log(results[i]);
            if (_.isEmpty(results[i].value)) {
              output[i] = {
                nodeId : nodes[i].nodeId.value,
                value : '',
                error : results[i].statusCode.description
              };
            } else {
              output[i] = {
                nodeId : nodes[i].nodeId.value,
                value : results[i].value.value
              };
            }
          }
        }
        return output;
      },

      /**
       * Add object attributes to results array accodring to nodeId in results
       * {nodeId, value} --> {nodeId, value, submitEvent, updateEvent,
       * containerId}
       * 
       * @param data
       * @returns {Array}
       */
      _addEventsAndIdsToResultsArray : function(data) {
        var output = new Array;
        // Add new attributes to the object of every array entry
        output = _.map(data, function(entry) {
          var eventObject = {
            submitEvent : 'submitEv'
                + opcua._convertNodeIdToEvent(entry.nodeId),
            updateEvent : 'updateEv'
                + opcua._convertNodeIdToEvent(entry.nodeId),
            containerId : opcua._convertNodeIdToContainerId(entry.nodeId)
          };
          return _.extend(entry, eventObject);
        });
        return output;
      },

      /**
       * deprecated
       */
      _addNameForResultObject : function(data) {
        var output = new Array;
        // Find .AlphaNumeric beginning from end of line, then the points needs
        // to be sliced away.
        var exp = /\.\w*$/
        // Add new attributes to the object of every array entry
        output = _.map(data, function(entry) {
          var eventObject = {
            name : entry.nodeId.match(exp)[0].slice(1)
          };
          return _.extend(entry, eventObject);
        });
        return output;
      },

      /**
       * Format resultObject from ReadArray to a jade-compatible Container
       * 
       * @param data
       *          [{nodeId: ..., value: ...},{nodeId: ..., value: ...}]
       * @return output array {MI5: Recipe{ [Dummy: ..., Name: ...,
       *         UserParameter: [{Dummy : ..., Default: ...,}]]}
       */
      _formatResultObjectToJade : function(data) {
        var output = new Array;

        return output;
      },

      /**
       * Transforms a nodeId to a uniqueEvent ID
       * 
       * @param nodeId
       *          (e.g. MI5.Module1101.Output.SkillOutput.SkillOutput0.Busy)
       * @return nodeId
       */
      _convertNodeIdToEvent : function(nodeId) {
        // var output = nodeId.slice(-8)
        // output = _.uniqueId(output);
        //
        // return output;
        return nodeId; // test for session
      },

      /**
       * Converts nodeId to MD5 hash, so that it is container-id compatible id
       * at thebeginning necessary, if md5 should start with a digit
       * 
       * @param nodeId
       * @return (e.g.) idFKDJ48238fhFak1
       */
      _convertNodeIdToContainerId : function(nodeId) {
        // return _.uniqueId('id' + md5(nodeId).slice(3, 10));
        return 'id' + md5(nodeId);
      },

      /**
       * Adds Parameters to a basenode :Recipe[0].YYYYYYYYYY
       * 
       * @param baseNode
       *          string
       * @return array
       */
      _structRecipeBase : function(baseNode) {
        var nodes = [ 'Description', 'Dummy', 'Name', 'RecipeID' ];
        // Add all 5 UserParameters
        for (var i = 0; i <= 5; i++) {
          var temp = opcua._structRecipeUserParameter('UserParameter[' + i
              + '].');
          temp.forEach(function(item) {
            nodes.push(item);
          });
        }
        // Prepend baseNode
        nodes = _.map(nodes, function(item) {
          return baseNode + item;
        });

        return nodes;
      },

      /**
       * Adds nodes to UserParameter[x].YYYYYYYYYYY
       * 
       * @param baseNode
       *          string
       * @return array
       */
      _structRecipeUserParameter : function(baseNode) {
        var nodes = [ 'Default', 'Description', 'Dummy', 'MaxValue',
            'MinValue', 'Name', 'Step', 'Unit' ];
        // Prepend baseNode
        nodes = _.map(nodes, function(item) {
          return baseNode + item;
        });
        return nodes;
      },

      /**
       * 
       * @param baseNode
       *          string
       * @return array
       */
      _structMessageFeed : function(baseNode) {
        var nodes = [ 'ID', 'Level', 'Message', 'Timestamp' ];
        // Prepend baseNode
        nodes = _.map(nodes, function(item) {
          return baseNode + item;
        });

        return nodes;
      },

    };

    return opc;
  }());

  /*
   * Inherit the EventEmitter methods like .emit(), .on(), ...s
   */
  opc.prototype.__proto__ = events.EventEmitter.prototype; // __proto__ is
  // deprecated, but
  // shouldn't be a problem.

  /*
   * Check head of this file - needed for scope issues
   */
  opcua = new opc();
  return opcua;
}; // end: exports.server()
