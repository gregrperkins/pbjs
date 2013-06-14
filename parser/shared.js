var util = require('util');
var Annotation = require('./annotation');

/**
 * The base class for all descriptor items.
 * @param {Object} data
 * @constructor
 */
var DescriptorItem = function (data) {
  /**
   * Array of annotations defined on this descriptor item.
   * @type {!Array.<Annotation>}
   */
  this.annotations = [];

  /**
   * The parent message, if known.
   * @type {?DescriptorItem}
   */
  this.parent = null;
};

/**
 * Register all the given descriptor items into this descriptor
 * @param {Array.<DescriptorItem>} items
 */
DescriptorItem.prototype.registerAll = function (items) {
  // items.forEach(this.register.bind(this)); // FIXME(gregp)
  for (var i = 0, i_len = items.length; i < i_len; ++i) {
    this.register(items[i]);
  }
};

/**
 * Generates the js output path for the given item.
 * @param {boolean=} opt_ignoreNamespaces - Used for fullName
 * @return {string}
 */
DescriptorItem.prototype.jsPath = function (opt_ignoreNamespaces) {
  var result = '';
  if (this.name) {
    result += this.name;
  }
  if (this.parent) {
    result = this.parent.jsPath(opt_ignoreNamespaces) + '.' + result;
  }
  return result;
};

/**
 * Generates the pacakge path for the given item.
 * This should be composed of the `package` directive, if explicitly given, and
 *  the name of the object.
 * TODO(gregp): it is quirky that this is separate from the jsPath;
 *  this appears to conform to the closure lib example, but
 *  it doesn't completely make sense to me.
 * @return {string}
 */
DescriptorItem.prototype.packagePath = function () {
  var result = '';
  if (this.name) {
    result += this.name;
  }
  if (this.parent) {
    var parentPath = this.parent.packagePath();
    if (parentPath) {
      result = parentPath + '.' + result;
    }
  }
  return result;
};

/**
 * Resolves the protobuf path of the given item.
 * @param {!Array.<string>} path - Array of namespace segments
 * @return {DescriptorItem}
 */
DescriptorItem.prototype.resolve = function (path) {
  // console.log('----- target', path, 'from', this.toString());
  if (!path.length) {
    // console.log('returning', this.toString());
    return this;
  }

  if (this.byName) {
    var key = path[0];
    var next = this.byName[key];
    var rest = path.slice(1);
    if (next) {
      // console.log(key, 'is', next && next.toString(), '-- seeking', rest);
      return next.resolve(path.slice(1));
    }
    // console.log('Named keys here: ', Object.keys(this.byName));
  }
  if (this.parent) {
    // console.log('parent', this.parent.toString());
    return this.parent.resolve(path);
  }

  // console.log('RETURNING NULL');
  return null;
};

/**
 * Register all the given descriptor items into this descriptor
 * @param {DescriptorItem} item
 */
DescriptorItem.prototype.register = function (item) {
  if (item instanceof Annotation) {
    this.annotations.push(item);
    item.parent = this;
  } else {
    // Programming error.
    throw new ValidationError('Unknown item type registered in '+ this
      + ': ' + item);
  }
};

/**
 * @constructor
 * @extends {Error}
 */
var ValidationError = function (msg, opt_source, opt_cause) {
  this.source = opt_source;
  this.cause = opt_cause;
  this.message = msg;
  Error.captureStackTrace(this, ValidationError);
};
util.inherits(ValidationError, Error);

/**
 * @constructor
 * @extends {ValidationError}
 */
var PathError = function (msg, field, goal) {
  this.field = field;
  this.goal = goal;
  if (goal && field) {
    msg += ' ' + goal + ' for ' + field.toString();
  }
  ValidationError.call(this, msg);
};
util.inherits(PathError, ValidationError);

/**
 * @constructor
 */
var ImportError = function (imptStr, protoSet) {
  var packages = Object.keys(protoSet.byPath).join('", "');
  var msg = 'Unresolved import: ' + imptStr + '; ' +
    'Known packages = ["' + packages + '"]';
  ValidationError.call(this, msg);
};
util.inherits(ImportError, ValidationError);

/**
 * @enum {!string}
 */
var LABEL = {
  REQUIRED: 'required',
  OPTIONAL: 'optional',
  REPEATED: 'repeated',
};

module.exports = {
  DescriptorItem: DescriptorItem,
  ValidationError: ValidationError,
  PathError: PathError,
  ImportError: ImportError,
  LABEL: LABEL,
};
