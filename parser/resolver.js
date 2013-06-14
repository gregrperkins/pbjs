var besync = require('besync');
var funct = require('funct');

var CustomType = require('./type').CustomType;
var ImportError = require('./shared').ImportError;
var PathError = require('./shared').PathError;
var Type = require('./type').Type;

var cli = require('../pbjs/cli');

/**
 * Create a function that resolves the include statements in a ProtoFile
 * @param {ProtoFile} protoFile
 * @param {function(ProtoFile, function(Error=, ProtoFile))} cb
 */
var resolveIncludes = function (protoFile, cb) {
  var protoSet = protoFile.parent;
  protoFile.imports.forEach(function (impt) {
    var imptStr = impt.str;
    var res = protoSet.byPath[imptStr];
    if (!res) {
      var err = new ImportError(imptStr, protoSet);
      return cb(err);
    }

    impt.set(res);
  });
  cb(null, protoFile);
};

/**
 * Create a function that determines the js namespace for a file's messages
 * TODO(gregp): probably remove this...
 * @param {ProtoFile} protoFile
 * @param {function(ProtoFile, function(Error=, ProtoFile))} cb
 */
var resolveJsNamespace = function (protoFile, cb) {
  protoFile.jsNamespace = protoFile.jsPath() || '';

  // Pass the ProtoFile to the next handler
  cb(null, protoFile);
};

// Build the type map, so we can quickly determine whether a type is builtin
var BUILTIN_TYPE_MAP = (function(obj) {
  var BUILTIN_TYPE = require('./type').BUILTIN_TYPE;
  var enumKey;
  for (enumKey in BUILTIN_TYPE) {
    var enumVal = BUILTIN_TYPE[enumKey];
    obj[enumVal] = enumVal;
  }
  return obj;
})({});

/**
 * Determine all the types in the given file
 * @param {ProtoFile} protoFile
 * @param {function(ProtoFile, function(Error=, ProtoFile))} cb
 */
var dereferenceFileTypes = function (protoFile, cb) {
  function dereferenceFieldDefault (field) {
    var rawRef;
    if (!field.defaultValue || !(rawRef = field.defaultValue.ref)) {
      return;
    }

    var refSpec = rawRef.split('.');
    var src = field.resolve(refSpec);
    // console.log('resolved', rawRef, '->', src);
    field.defaultValue.src = src;
  };

  var dereferenceFieldType = function (field) {
    var rawType = field.rawType;

    // If the type is a builtin, just set and return it.
    if (BUILTIN_TYPE_MAP[rawType]) {
      field.type = new Type(rawType);
      return field;
    }

    // Tokenize the type string and try to find it
    var typeSpec = rawType.split('.');
    // console.log(field.toString(), 'seeking', rawType, typeSpec);
    var source = field.resolve(typeSpec);
    // console.log(source.toString());
    if (!source) {
      throw new PathError('Could not resolve', field, rawType);
    }
    field.type = new CustomType(source);

    dereferenceFieldDefault(field);
  };

  var dereferenceMessageTypes = function (msg) {
    msg.fields.forEach(dereferenceFieldType);
    msg.messages.forEach(dereferenceMessageTypes);
  };

  // Look at each of the messages in this protoFile
  try {
    protoFile.messages.forEach(dereferenceMessageTypes);
    cb(null, protoFile);
  } catch (err) {
    cb(err);
  }
};

/**
 * @param {ProtoFile} protoFile
 * @param {function(ProtoFile, function(Error=, ProtoFile))} cb
 */
var resolveFile = function (protoFile, cb) {
  cli.log('[PBJS] Resolving types... ' + protoFile.path);
  return besync.waterfall(cb, [
    funct.injector(protoFile),
    resolveIncludes,
    resolveJsNamespace,
    dereferenceFileTypes,
  ], this);
};

/**
 * Resolves the includes within a given set
 * TODO(gregp): A merge/validation step to ensure no vague include paths
 *    e.g. Parser.prototype._mergeProtoFileSets(...ProtoFileSet)
 */
var resolveSet = function (protoSet, cb) {
  var protoFiles = protoSet.files;
  return besync.forEach(protoFiles,
    resolveFile,
    // TODO(gregp): better combine function, should forEach accept [fn, fn]?
    funct.returner(cb, protoSet)
  );
};

module.exports = {
  resolveSet: resolveSet,
  resolveFile: resolveFile
};
