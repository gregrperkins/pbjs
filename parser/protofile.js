var util = require('util');
var DescriptorItem = require('./shared').DescriptorItem;
var ValidationError = require('./shared').ValidationError;

var Enum = require('./enum');
var Field = require('./field');
var Import = require('./import');
var Message = require('./message').Message;
var Extend = require('./extend');

var Option = require('./option');
var Package = require('./package');
var PathError = require('./shared').PathError;

/**
 * A Protobuf File
 * @param {Object} data - A map of things in this file
 * @constructor
 */
var ProtoFile = function(data) {
  /**
   * The path of the file.
   * @type {string}
   */
  this.path = '';

  /**
   * Messages defined directly at the top level of the .proto file.
   * @type {!Array.<Message>}
   */
  this.messages = [];

  /**
   * Items (messages, services, ...etc?) accessible by their names.
   * It is legal to have two messages in one file with the same name
   *  if they are on different parents.
   */
  this.byName = {};

  /**
   * Options are mapped by key to the option descriptors.
   * @type {Object.<string, Option>}
   */
  this.options = {};

  /**
   * Imports are not validated until after parsing is complete.
   * @type {Array.<string>}
   */
  this.imports = [];

  /**
   * Holds the package specified for this ProtoFile, if any.
   * @type {?Package}
   */
  this.packageSpec = null;

  /**
   * Holds the resolved js namespace, once known.
   * @type {?string}
   */
  this.jsNamespace = null;

  /**
   * Holds the resolved protobuf namespace, if known
   * @type {?Namespace}
   */
  this.pbNamespace = null;

  DescriptorItem.call(this);
  this.registerAll(data.items || []);
};
util.inherits(ProtoFile, DescriptorItem);

/** @return {!string} */
ProtoFile.prototype.toString = function() {
  return '[protofile ' + this.path + ']';
};

/**
 * Register the given item on this file descriptor.
 * @param {ProtoFileItem}
 */
ProtoFile.prototype.register = function (item) {
  if (!item) return; // handle useless syntax slug
  if (item instanceof Extend) {
    return; // TODO(gregp): handle extend
  }
  if (item instanceof Message) {
    var name = item.name;
    if (this.byName[name]) {
      throw new ValidationError('Duplicate message with name ' + name
        + ' detected in file ' + this.path);
    }
    this.byName[name] = item;
    this.messages.push(item);
    item.parent = this;
    return;
  }
  if (item instanceof Option) {
    var key = item.key;
    if (this.options[key]) {
      throw new ValidationError('Duplicate option of ' + item
        + ' detected in file ' + this);
    }
    this.options[key] = item;
    item.parent = this;
    return;
  }
  if (item instanceof Package) {
    if (this.packageSpec) {
      throw new ValidationError('Duplicate package directive ' +
        + ' detected in file '+ this);
    }
    this.packageSpec = item;
    item.parent = this;
    return;
  }
  if (item instanceof Import) {
    this.imports.push(item);
    item.parent = this;
    return;
  }
  if (item instanceof Field) {
    throw new ValidationError('Cannot have a field in a protobuf top level.');
  }
  if (item instanceof Enum) {
    throw new ValidationError('Cannot have a raw enum in a protobuf file.');
  }
  DescriptorItem.prototype.register.call(this, item);
};

/**
 * Set to true to test resolve
 * @const {boolean}
 */
ProtoFile.UNSAFE_RESOLUTION = false;

/**
 * Path resolution in the ProtoFile is a bit funky, since we have to:
 *  1. check byName (for messages/enums)
 *  2. check any imports
 *  3. escalate to parent
 * (note that we should never return ourselves here.)
 *
 * @param {!Array.<string>} path
 * @return {DescriptorItem}
 * @override
 */
ProtoFile.prototype.resolve = function (path) {
  // console.log('SPECIAL CASE -- ProtoFile', this.toString(), path);
  if (!path.length) {
    if (ProtoFile.UNSAFE_RESOLUTION) {
      return this;
    }
    throw new PathError('Illegally tried to resolve the protobuf file ' + this
      + ' as a type.');
  }
  // console.log('Named keys here: ', Object.keys(this.byName));

  // Check byName
  var key = path[0];
  var next = this.byName[key];
  var rest = path.slice(1);
  if (next) {
    // console.log(key, 'is', next && next.toString(), '-- seeking', rest);
    return next.resolve(path.slice(1));
  }

  // Check whether there are any results from the import statements
  var result, impt, imports = this.imports.slice(0);
  while (impt = imports.pop()) {
    result = impt.ref.resolve(path);
    if (result) return result;
  }
  // console.log('Not an import');

  // see if the namespace's got anything to say about it...
  if (this.pbNamespace) {
    // console.log('pbNamespace', this.pbNamespace.toString());
    return this.pbNamespace.resolve(path, this);
  }

  // else, no result
  return null;
};

/**
 * Return the package path of this file.
 * @return {!string}
 */
ProtoFile.prototype.packagePath = function () {
  var pack = this.packageSpec;
  return pack ? pack.str : '';
};

/**
 * Create a function that determines the js namespace for a file's messages
 * @return {!string}
 */
ProtoFile.prototype.jsPath = function () {
  var result;

  // Try to find the javascript_package first
  var opt = this.options['javascript_package'];
  if (opt) {
    return opt.value;
  }

  // Then check for the package directive
  var pack = this.packageSpec;
  if (pack) {
    result = pack.str;
    return result;
  }

  if (this.pbNamespace) {
    return this.pbNamespace.prefix;
  }

  return this.name;
};

module.exports = ProtoFile;
