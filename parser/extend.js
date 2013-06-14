var util = require('util');

var DescriptorItem = require('./shared').DescriptorItem;

/**
 * A Protobuf Extension. Parses like a message, and applies any contents
 *  to the message with its name.
 * @param {Object} data - A map of possible attributes: name, items
 * @constructor
 */
var Extend = function(data) {
  var annotations = data.annotations || [];

  /**
   * The name of the message.
   * @type {!string}
   */
  this.name = data.name;

  /**
   * The items, stored for eventual application to the message.
   * @type {!Array.<DescriptorItem>}
   */
  this.items = data.items || [];

  DescriptorItem.call(this);
  this.registerAll(annotations);
};
util.inherits(Extend, DescriptorItem);

Extend.prototype.CLASS = "extend";

module.exports = Extend;
