var util = require('util');
var DescriptorItem = require('./shared').DescriptorItem;

/**
 * An import in a ProtoFile.
 * @param {!string} data - string value of this import
 * @constructor
 */
var Import = function (data) {
  /**
   * The import path.
   * @type {!string}
   */
  this.str = data;

  /**
   * Resolved reference. Initially null, until all the files are parsed.
   * @type {?ProtoFile}
   */
  this.ref = null;

  DescriptorItem.call(this);
  this.registerAll(data.items || []);
};
util.inherits(Import, DescriptorItem);

/**
 * Resolves to the given reference.
 * @param {ProtoFile} file
 */
Import.prototype.set = function (file) {
  this.ref = file;
};

/**
 * Return a pretty-formatted string for this import.
 * @return {string}
 */
Import.prototype.toString = function () {
  return '[import ' + this.key + ' = ' + this.value + ']';
};

module.exports = Import;
