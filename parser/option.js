var util = require('util');
var DescriptorItem = require('./shared').DescriptorItem;

/**
 * An option, either in a ProtoFile, a Message, or a Field.
 * @param {key: string, value: *} data - key & value of this option
 * @constructor
 */
var Option = function (data) {
  /**
   * The option key
   * @type {!string}
   */
  this.key = data.key;

  /**
   * The option value
   * @type {*}
   */
  this.value = data.value;

  DescriptorItem.call(this);
  this.registerAll(data.items || []);
};
util.inherits(Option, DescriptorItem);

/**
 * Return a pretty-formatted string for this option.
 * @return {string}
 */
Option.prototype.toString = function () {
  return '[option ' + this.key + ' = ' + this.value + ']';
};

module.exports = Option;
