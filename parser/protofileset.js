var path = require('path');
var DescriptorItem = require('./shared').DescriptorItem;
var PathError = require('./shared').PathError;
var ProtoFile = require('./protofile');
var util = require('util');

/** @constructor */
var Namespace = function(rootPath, opt_prefix) {
  /**
   * @type {!string}
   */
  this.root = rootPath;

  /**
   * '.javascript.closure.package_test', for instance
   * @type {!string}
   */
  this.prefix = opt_prefix || '';

  /**
   * @type {Array.<ProtoFile>}
   */
  this.files = [];

  /**
   * TODO(gregp): getter
   * @type {Object.<string, Namespace>}
   */
  this.byName = {};
};
util.inherits(Namespace, DescriptorItem);

Namespace.prototype.toString = function () {
  return '[namespace ' + this.prefix + ']';
};

/**
 * @param {ProtoFile} incoming
 * @param {Array.<string>=} path
 */
Namespace.prototype.register = function (incoming, path) {
  // console.log(this.toString(), 'registering', path);
  if (!path.length) {
    // TODO(gregp): ensure no conflicts byName
    // this.files.push(incoming);
    var newByName = incoming.byName || {};
    var name;
    for (name in newByName) {
      if (this.byName[name]) {
        throw new Error('Namespace conflict; ' + this.toString() +
          ' existing: ' + this.byName[name].parent.path +
          ' incoming: ' + newByName[name].parent.path);
      }
      this.byName[name] = newByName[name];
    }
    incoming.pbNamespace = this;
    return;
  }

  // Get the next item
  var key = path.shift();
  var next = this.byName[key];
  // console.log('key', key, '; next', next);

  if (!next) {
    // Nothing exists at this namespace point, need to create one.
    next = new Namespace(this.root, this.prefix + '.' + key);
    next.parent = this;
    // console.log('incoming', incoming.toString(), 'next', next.toString());
    this.byName[key] = next;
  }

  // Go deeper.
  next.register(incoming, path);
};

Namespace.UNSAFE_RESOLUTION = false;

Namespace.prototype.resolve = function (path, fromFile) {
  // console.log('resolving from namespace', path);
  if (!path.length) {
    if (Namespace.UNSAFE_RESOLUTION) {
      return this;
    }
    throw new Error('Cannot resolve a namespace as a pathed object.');
  }

  var key = path[0];
  // console.log('Searching for path', path, 'in', this.toString());
  var next = this.byName[key];
  var result;
  if (next) {
    result = next.resolve(path.slice(1));
  }
  if (!result) {
    result = this.parent && this.parent.resolve(path);
  }
  return result;
};

/**
 * @constructor
 */
var ProtoFileSet = function (root, protoFiles) {
  /**
   * @type {!string} root
   */
  this.root = root;

  /**
   * @type {!Array.<ProtoFile>}
   */
  this.files = protoFiles;

  /**
   * Store pointers to the files keyed by their path relative to the root
   * @type {!Object.<string, ProtoFile>}
   */
  this.byPath = {};

  /**
   * Store namespaces that this ProtoFileSet is holding.
   * @type {!Namespace}
   */
  this.namespace = new Namespace(root);

  protoFiles.forEach(this.registerFile.bind(this));
};

/**
 * @param {!Array.<string>} path
 * @return {DescriptorItem}
 * @override
 */
ProtoFileSet.prototype.resolve = function (path) {
  // console.log('Resolving from fileset ' + this, path);
  return this.namespace.resolve(path);
};


ProtoFileSet.prototype.toString = function () {
  return '[fileset ' + this.root + ']';
};

/**
 * Compute the protobuf namespace for the given protoFile.
 */
ProtoFileSet.prototype.protoFileToNamespacePath = function (protoFile) {
  var namespace;
  var relPath = path.relative(this.root, protoFile.path);
  // console.log('relPath', relPath);
  // console.log(protoFile);
  if (protoFile.packageSpec) {
    namespace = protoFile.packageSpec.str.split('.');
  } else {
    namespace = relPath.replace(/\.proto$/, '').split(path.sep);
  }
  // console.log(relPath, '->', namespace);
  return namespace;
};

ProtoFileSet.prototype.registerFile = function (protoFile) {
  var relPath = path.relative(this.root, protoFile.path);
  if (this.byPath[relPath]) {
    // This should never occur, since it means that we were given
    //  two ProtoFile's that have the same path.
    throw new Error('Multiple ProtoFiles at the same path...?');
    // TODO(gregp): remove?
  }

  var nsPath = this.protoFileToNamespacePath(protoFile);
  this.namespace.register(protoFile, nsPath);

  this.byPath[relPath] = protoFile;
  protoFile.parent = this;
};

module.exports = ProtoFileSet;
ProtoFileSet.Namespace = Namespace;
