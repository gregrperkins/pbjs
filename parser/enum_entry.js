var util = require('util');
var DescriptorItem = require('./shared').DescriptorItem;
/**
 * An Entry in a Protobuf Enum
 * @param {Object} data - Information about this enum
 * @constructor
 */
var EnumEntry = function (data) {
  /**
   * @type {!string}
   */
  this.name = data.name;

  /**
   * The tag number
   * @type {!number}
   */
  this.tag = data.tag;

  DescriptorItem.call(this);
  this.registerAll(data.items || []);
};
util.inherits(EnumEntry, DescriptorItem);

/**
 * Return a pretty-formatted string for this entry.
 * @return {string}
 */
EnumEntry.prototype.toString = function () {
  return '[enum ' + this.name + ' = ' + this.tag + ']';
};

module.exports = EnumEntry;
