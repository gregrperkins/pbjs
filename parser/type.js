var util = require('util');

/**
 * @enum {!string}
 */
var BUILTIN_TYPE = {
  BOOL: 'bool',
  BYTES: 'bytes',
  DOUBLE: 'double',
  FIXED32: 'fixed32',
  FIXED64: 'fixed64',
  FLOAT: 'float',
  INT32: 'int32',
  INT64: 'int64',
  SFIXED32: 'sfixed32',
  SFIXED64: 'sfixed64',
  SINT32: 'sint32',
  SINT64: 'sint64',
  STRING: 'string',
  UINT32: 'uint32',
  UINT64: 'uint64'
};

var Type = function (name) {
  this.name = name;
};

Type.prototype.toString = function() {
  return '[type ' + this.name + ']';
};

var CustomType = function (src) {
  /**
   * @type {DescriptorItem}
   */
  this.src = src;

  // TODO(gregp): fully qualified path
  Type.call(this, src.name);
};
util.inherits(CustomType, Type);

CustomType.prototype.toString = function() {
  return '[customtype ' + this.src + ']';
};

module.exports = {
  BUILTIN_TYPE: BUILTIN_TYPE,
  Type: Type,
  CustomType: CustomType,
};
