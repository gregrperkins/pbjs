var besync = require('besync');
var fs = require('fs');
var path = require('path');
var glob = require('glob');
var util = require('util');
var PEG = require('pegjs');

var cli = require('../pbjs/cli');
var enforcer = require('./enforcer');

/**
 * A protobuf parser, converts .proto files into descriptors.
 *  Uses PEGjs for parsing and validation, then does some post processing.
 *
 * TODO(gregp): fix default= to use the option flow
 * TODO(gregp): jsdoc parsing
 * TODO(gregp): extension, <file> enum, service, rpc
 *
 * @constructor
 */
var Parser = function(opts) {
  this.grammarPath = path.resolve(
    path.dirname(__filename), '..', 'parser', 'protobuf.pegjs');

  this.opts = opts || {};
};
module.exports = Parser;

Parser.Annotation = require('./annotation');
Parser.CustomType = require('./type').CustomType;
Parser.DescriptorItem = require('./shared').DescriptorItem;
Parser.Enum = require('./enum');
Parser.EnumEntry = require('./enum_entry');
Parser.Extend = require('./extend');
Parser.Field = require('./field');
Parser.Group = require('./message').Group;
Parser.Import = require('./import');
Parser.ImportError = require('./shared').ImportError;
Parser.Message = require('./message').Message;
Parser.Namespace = require('./protofileset').Namespace;
Parser.Option = require('./option');
Parser.Package = require('./package');
Parser.PathError = require('./shared').PathError;
Parser.ProtoFile = require('./protofile');
Parser.ProtoFileSet = require('./protofileset');
Parser.Resolver = require('./resolver');
Parser.Type = require('./type').Type;
Parser.ValidationError = require('./shared').ValidationError;

/**
 * Reads the protobuf pegjs grammar from the file, then converts it to data.
 * @param {function(Error=, string)} cb - Given the grammar string.
 */
Parser.prototype._readGrammar = function (cb) {
  besync.waterfall(cb, [
    fs.readFile.bind(fs, this.grammarPath),
    function (data, done) {
      done(null, data.toString());
    }
  ], this);
};

/**
 * Ask PEG to (synchronously) build the parser.
 * @param {string} grammarData
 * @param {function(Error=)} cb
 */
Parser.prototype._buildParser = function (grammarData, cb) {
  this.protoParser = PEG.buildParser(grammarData, {
    trackLineAndColumn: true
  });
  cb();
};

/**
 * Ensures that this.protoParser is initialized properly.
 * @param {function(Error=)} cb
 */
Parser.prototype.init = function (cb) {
  if (this.protoParser) {
    cb();
  } else {
    besync.waterfall(cb, [
      this._readGrammar,
      this._buildParser
    ], this);
  }
}

/**
 * Create a function that registers the given path onto ProtoFile's.
 */
function _filePathRegistrar(protoPath) {
  return function (descriptor, cb) {
    if (descriptor instanceof Parser.ProtoFile) {
      descriptor.path = protoPath;
      return cb(null, descriptor);
    }
    return cb(new Error('Cannot add path to non-ProtoFile: ', descriptor));
  }
};

/**
 * Reads and parses a given .proto file.
 * @param {string} protoPath
 * @param {function(Error=, Object)} cb - Given the final descriptor
 */
Parser.prototype.parseFile = function (protoPath, cb) {
  var absPath = path.resolve(protoPath);
  cli.log('[PBJS] Parsing... ' + absPath);
  return besync.waterfall(function (err, result) {
    if (err) {
      err.message = '[file ' + absPath + ']: ' + err.message;
      // console.trace();
    }
    cb(err, result);
  }, [
    this.init,
    fs.readFile.bind(fs, absPath),
    this._parse,
    _filePathRegistrar(absPath),
    enforcer.bind(this, this.opts.enforceJsDocs),
  ], this);
};

/**
 * Parses the given file data without configuring its path relative
 *  to a root (output will be hard to namespace if this is used alone)
 * @param {string} protobufData
 * @param {function(Error=, ProtoFile)} cb - Passed the ProtoFile descriptor
 */
Parser.prototype.parseFileData = function (protobufData, cb) {
  return besync.waterfall(cb, [
    this.init,
    this._parse.bind(this, protobufData),
    Parser.Resolver.resolveFile,
  ], this);
};

/**
 * Runs the given data through the protobuf parser.
 * @param {!string} protobufData
 * @param {function(Error=, ProtoFile)} cb - Passed the parsed descriptor.
 */
Parser.prototype._parse = function (protobufData, cb) {
  try {
    var str = protobufData.toString();
    var descriptor = this.protoParser.parse(str);
  } catch (err) {
    if (err instanceof Parser.ValidationError) {
      return cb(err);
    }
    var actualErr = new Error('Protobuf parse error at line ' +
      err.line + ', column ' + err.column + '; ' + err);
    actualErr.stack = err.stack;
    return cb(actualErr);
  }
  cb(null, descriptor);
};

/**
 * Create a protobuf file set by parsing all the .proto files
 *  reltative to a given root path.
 * @param {!string} rootPath
 * @param {function(Error=, ProtoFileSet)} cb - Passed the
 *    resulting ProtoFileSet object
 */
Parser.prototype.parseFileSet = function (rootPath, cb) {
  return besync.waterfall(cb, [
    protoFilesFinder(rootPath),
    this._parseFiles,
    this._wrapFileSet.bind(this, rootPath),
    Parser.Resolver.resolveSet
  ], this);
};

/**
 * Parses a set of paths into ProtoFile objects
 * @param {Array.<string>} pathArray
 * @param {function(Error=, Array.<ProtoFile>)} cb - Passed an array of parsed
 *    ProtoFile objects.
 */
Parser.prototype._parseFiles = function (pathArray, cb) {
  return besync.map(pathArray, this.parseFile, cb, this);
};

/**
 * Create a ProtoFileSet from the given array of ProtoFile objects,
 *  and pass it to the callback
 * @param {string} rootPath
 * @param {Array.<ProtoFile>} protoFileArray
 * @param {function(Error=, ProtoFileSet)} cb - For the generated ProtoFileSet
 */
Parser.prototype._wrapFileSet = function (rootPath, protoFileArray, cb) {
  if (!protoFileArray.length) {
    cb(new Error('No protobuf models found in ' + rootPath));
  }
  try {
    var fileSet = new Parser.ProtoFileSet(rootPath, protoFileArray);
    cb(null, fileSet);
  } catch (err) {
    cb(err);
  }
};

//////////////////////////////////////////////////////////////////////////////
// TODO(gregp): multiglob already
var filesWithExt = function (ext, opts, root, cb) {
  var spec = root + '/**/*.' + ext;
  // TODO(gregp): statCache
  glob(spec, opts || {}, cb);
};
var pbJsFilesFinder = function (root) {
  return function (cb) {
    return filesWithExt('pb.js', null, root, cb);
  };
};
var protoFilesFinder = function (root) {
  return function (cb) {
    return filesWithExt('proto', null, root, cb);
  };
};
//////////////////////////////////////////////////////////////////////////////
