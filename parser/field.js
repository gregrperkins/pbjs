var util = require('util');
var DescriptorItem = require('./shared').DescriptorItem;
var ValidationError = require('./shared').ValidationError;
// TODO(gregp): field options, require('./field_option');

/**
 * A Protobuf Message Field
 * @param {Object} data - Information about this field
 * @constructor
 */
var Field = function(data) {
  /**
   * @type {!LABEL}
   */
  this.label = data.label;

  /**
   * @type {!string}
   */
  this.rawType = data.type;

  /**
   * The resolved type, if known.
   * @type {?Type}
   */
  this.type = null;

  /**
   * @type {!string}
   */
  this.name = data.name;

  /**
   * The tag number
   * @type {!number}
   */
  this.tag = data.tag;

  /**
   * If a defaultValue was given, that value.
   * TODO(gregp): validate against this.type
   * TODO(gregp): convert to options map (possibly custom)
   * @type {*}
   */
  this.defaultValue = data.defaultValue;

  DescriptorItem.call(this);
  this.registerAll(data.items || []);
};
util.inherits(Field, DescriptorItem);

/**
 * Add an annotation to this entry, or complain if given something else.
 */
Field.prototype.register = function (item) {
  DescriptorItem.prototype.register.call(this, item);
};

Field.prototype.toString = function() {
  return '[field "' + this.name + '"]';
};

module.exports = Field;
