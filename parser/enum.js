var util = require('util');
var EnumEntry = require('./enum_entry');
var DescriptorItem = require('./shared').DescriptorItem;
var ValidationError = require('./shared').ValidationError;

/**
 * A Protobuf Enum
 * @param {Object} data - Information about this enum
 * @constructor
 */
var Enum = function (data) {
  /**
   * @type {!string}
   */
  this.name = data.name;

  /**
   * @type {!Array.<EnumEntry>}
   */
  this.entries = [];

  /**
   * @type {!Object.<number, EnumEntry>}
   */
  this.byTag = {};

  /**
   * @type {!Object.<string, EnumEntry>}
   */
  this.byName = {};

  DescriptorItem.call(this);
  this.registerAll(data.items || []);
};
util.inherits(Enum, DescriptorItem);

/**
 * Ensure that there is no local conflict for name or tag on this enum.
 * @param {!EnumEntry} entry
 */
Enum.prototype._validateEntry = function (entry) {
  var name = entry.name;
  if (this.byName[name]) {
    throw new ValidationError('Duplicate enum entry with name ' + name
      + ' on ' + this.name);
  }
  var tag = entry.tag;
  if (this.byTag[tag]) {
    throw new ValidationError('Duplicate enum entry with tag ' + tag
      + ' on ' + this.name);
  }
};

/**
 * Register an item into the enum (only valid if an EnumEntry)
 * @param {Item} item
 */
Enum.prototype.register = function (item) {
  if (item instanceof EnumEntry) {
    this._validateEntry(item);
    this.byTag[item.tag] = item;
    this.byName[item.name] = item;
    this.entries.push(item);
    item.parent = this;
    return;
  }
  DescriptorItem.prototype.register.call(this, item);
};

Enum.prototype.CLASS = 'enum';

Enum.prototype.toString = function() {
  return '[Enum ' + this.name + ']';
};

module.exports = Enum;
