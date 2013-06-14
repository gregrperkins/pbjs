var util = require('util');
var DescriptorItem = require('./shared').DescriptorItem;

/**
 * An package directive in a ProtoFile.
 * @param {!string} data - string value of this package
 * @constructor
 */
var Package = function (data) {
  /**
   * The package string (e.g. google.protobuf.no_generic_services_test)
   * @type {!string}
   */
  this.str = data;

  DescriptorItem.call(this);
  this.registerAll(data.items || []);
};
util.inherits(Package, DescriptorItem);

/**
 * Return a pretty-formatted string for this package.
 * @return {string}
 */
Package.prototype.toString = function () {
  return '[package ' + this.key + ' = ' + this.value + ']';
};

module.exports = Package;
