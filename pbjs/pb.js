var path = require('path');
var besync = require('besync');
var funct = require('funct');
var fs = require('fs');
var SoySet = require('soyset');
var Parser = require('../parser/parser');
var cli = require('./cli');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');


/**
 * @constructor
 */
var PBJS = function(opts) {
  var opts = this.opts = opts || {};

  var templateRoot = opts.templateRoot ||
    path.resolve(path.dirname(__filename), '..', 'templates');
  this.templateRoot = templateRoot;
  this.outputRoot = path.resolve(opts.outputRoot || 'build');

  this.soyset = new SoySet();
  this.soyset._getSoyRoots = function(cb) {
    cb(null, [templateRoot]);
  };

  this.parser = new Parser(opts);
};

PBJS.prototype._setTemplates = function(templateObj, cb) {
  if (!templateObj.pbjs) {
    return cb(new Error('Templates did not compile correctly; ' +
      'should be in {namespace pbjs}.'));
  }

  this.templates = templateObj;
  cb(null, templateObj);
};

PBJS.prototype._getTemplates = function(cb) {
  if (this.templates) {
    return cb(null, this.templates);
  }

  return besync.waterfall(cb, [
    this.soyset.toFunctions.bind(this.soyset),
    this._setTemplates,
  ], this);
};

PBJS.prototype._initTemplates = function (cb) {
  return besync.waterfall(cb, [
    this._getTemplates,
    funct.dropAll
  ], this);
};

PBJS.prototype._getProtoFileSet = function (inputRoot, cb) {
  this.inputRoot = inputRoot;

  // TODO(gregp): parallelize
  return besync.waterfall(cb, [
    this._initTemplates,
    this.parser.parseFileSet.bind(this.parser, this.inputRoot),
  ], this);
};

/**
 * Removes anything in the outputRoot dir.
 * @param {function(Error=)} cb
 */
PBJS.prototype.clean = function (cb) {
  rimraf(this.outputRoot, cb);
};

PBJS.prototype._checkEmptyOutput = function (cb) {
  fs.exists(this.outputRoot, function (exists) {
    if (!exists) {
      return cb();
    }
    cb(new Error('Output directory '
      + this.outputRoot + ' exists;'
      + ' try PBJS#clean() first.'));
  }.bind(this));
};

PBJS.Task = function (protoFile, outputRoot, template) {
  this.protoFile = protoFile;
  this.inputPath = path.relative(protoFile.parent.root, protoFile.path);
  this.outputTarget = PBJS.Task._toOutputTarget(
    outputRoot, protoFile.jsNamespace, protoFile
  );
  this.outputPath = null; // to be set once conflicts are determined.
  this.template = template;
  this.data = {};
};

PBJS.Task._toOutputTarget = function (root, jsNamespace, protoFile) {
  var pathSpec = jsNamespace.split('.');
  pathSpec.unshift(root);

  var fileName = protoFile.path.toLowerCase();
  fileName = fileName.slice(fileName.lastIndexOf(path.sep) + 1);
  fileName = fileName.replace('.proto', '');
  // fileName += '.pb.js';
  pathSpec.push(fileName);

  var outputTarget = path.join.apply(path, pathSpec);
  // console.log(root, jsNamespace, protoFile.toString(), '->', outputTarget);
  return outputTarget;
};

PBJS.Task.prototype.toString = function () {
  return '<task '
    + [this.protoFile, '->', this.outputTarget].join(' ')
    + '>';
};

FIELD_TYPE_BUILTIN_MAP = {
  'int32': 'goog.proto2.Message.FieldType.INT32',
  'int64': 'goog.proto2.Message.FieldType.INT64',
  'uint32': 'goog.proto2.Message.FieldType.UINT32',
  'uint64': 'goog.proto2.Message.FieldType.UINT64',
  'sint32': 'goog.proto2.Message.FieldType.SINT32',
  'sint64': 'goog.proto2.Message.FieldType.SINT64',
  'fixed32': 'goog.proto2.Message.FieldType.FIXED32',
  'fixed64': 'goog.proto2.Message.FieldType.FIXED64',
  'sfixed32': 'goog.proto2.Message.FieldType.SFIXED32',
  'sfixed64': 'goog.proto2.Message.FieldType.SFIXED64',
  'float': 'goog.proto2.Message.FieldType.FLOAT',
  'double': 'goog.proto2.Message.FieldType.DOUBLE',
  'bool': 'goog.proto2.Message.FieldType.BOOL',
  'string': 'goog.proto2.Message.FieldType.STRING',
  'bytes': 'goog.proto2.Message.FieldType.BYTES',
  'int64_number': 'goog.proto2.Message.FieldType.INT64',
  'int64_string': 'goog.proto2.Message.FieldType.INT64',
};

JS_TYPE_BUILTIN_MAP = {
  'int32': 'Number',
  'int64': 'String',
  'uint32': 'Number',
  'uint64': 'Number',
  'sint32': 'Number',
  'sint64': 'String',
  'fixed32': 'Number',
  'fixed64': 'String',
  'sfixed32': 'Number',
  'sfixed64': 'String',
  'float': 'Number',
  'double': 'Number',
  'bool': 'Boolean',
  'string': 'String',
  'bytes': 'String',
  'int64_number': 'Number',
  'int64_string': 'String',
};

PBJS.Task._setJsDefault = function (field, type) {
  var dfault = field.defaultValue;
  if ((dfault === null) || (typeof dfault === 'undefined')) {
    field.hasJsDefault_ = false;
    return;
  } else {
    field.hasJsDefault_ = true;
  }

  if (dfault.src) {
    field.jsDefault_ = dfault.src.jsPath();
  } else {
    field.jsDefault_ = JSON.stringify(dfault.val);
  }

  // console.log(field.jsDefault_);
};

PBJS.Task._setGroupTypes = function (group) {
  group.containingType = group.parent.jsPath();
  group.jsType = group.jsPath();
  group.jsDocType = group.jsType;
};

PBJS.Task._setFieldTypes = function (field, type, src) {
  field.containingType = field.parent.jsPath();

  if (!src) {
    field.fieldType = FIELD_TYPE_BUILTIN_MAP[type.name];
    field.jsType = JS_TYPE_BUILTIN_MAP[type.name];
    field.jsDocType = field.jsType.toLowerCase();
    return field;
  }

  if (src instanceof Parser.Message) {
    field.fieldType = 'goog.proto2.Message.FieldType.MESSAGE';
  } else if (src instanceof Parser.Enum) {
    field.fieldType = 'goog.proto2.Message.FieldType.ENUM';
  } else if (src instanceof Parser.Group) {
    field.fieldType = 'goog.proto2.Message.FieldType.GROUP';
  } else {
    throw new Error('Unrecognized field type.');
  }
  field.jsType = src.jsPath();
  field.jsDocType = field.jsType;
  return field;
};

/**
 * Build the array of provides and the map of types that have been seen
 *  already in this file (and thus don't have to be required.)
 * @param {DescriptorItem} item - Root of the tree to search.
 * @param {Array.<Provide>} provides - Array of things which will be provided.
 * @param {Object.<string, boolean>} seenJsTypes - Keys represent seen types.
 */
PBJS.Task._registerProvidedTypes = function (item, provides, seenJsTypes) {
  var byName = item.byName;
  if (!byName) {
    return provides;
  }

  Object.keys(byName).forEach(function (name) {
    var child = byName[name];
    if (child instanceof Parser.Extend) {
      return; // TODO(gregp): handle extend
    }
    // console.log(child.toString());
    if (child instanceof Parser.Enum ||
        child instanceof Parser.Message ||
        child instanceof Parser.Group) {
      var jsPath = child.jsPath();
      seenJsTypes[jsPath] = child;
      provides.push({
        name: jsPath,
        item: child,
        type: child.CLASS,
      });
    }

    // Add the js Path for the provide item
    child.jsPath_ = child.jsPath();
    // Get the conceptual name
    child.fullName = child.packagePath();

    if (child.parent instanceof Parser.Message) {
      child.containingType = child.parent.jsPath();
    }

    if (child instanceof Parser.Message) {
      PBJS.Task._registerProvidedTypes(child, provides, seenJsTypes);
    }
    // console.log(child.groups);
  });
};

PBJS.Task.prototype.build = function () {
  cli.log('[PBJS] Building... ' + this.outputPath);
  // Convert the named items in the message to name/item pairs
  var provides = [];
  var seenJsTypes = {};
  PBJS.Task._registerProvidedTypes(this.protoFile, provides, seenJsTypes);
  // console.log(provides);

  // Get all the requirements, by looking at the type of every provide's fields
  var requires = [];
  provides.forEach(function (provide) {
    var item = provide.item;
    if (!item.fields) {
      // Done with this provide, no field types that might be required.
      // console.log('No Fields:', item.toString());
      return;
    }

    item.groups.forEach(function (group) {
      PBJS.Task._setGroupTypes(group);
      provides.push({
        name: group.jsType,
        item: group,
        type: group.CLASS,
      });
    });

    item.fields.forEach(function (field) {
      var type = field.type;
      var typeSrc = type.src;

      PBJS.Task._setFieldTypes(field, type, typeSrc);
      PBJS.Task._setJsDefault(field, type);

      if (!typeSrc) {
        // builtin type
        return;
      }

      var typeName = typeSrc.jsPath();
      if (!seenJsTypes[typeName]) {
        seenJsTypes[typeName] = typeSrc;
        requires.push({
          name: typeName,
          item: typeSrc,
        });
      }
    });
  });

  // console.log(this.toString(), requires);
  this.data.requires = requires;
  this.data.provides = provides;
  this.data.inputPath = this.inputPath;

  var output = this.template(this.data);
  return output;
};

/**
 * Converts a ProtoFileSet to a PBJS.Task map, by keeping together:
 *  1) the ProtoFile
 *  2) its output path
 *  3) the template used to write the pb.js file
 * @param {!ProtoFileSet} fileSet
 * @param {function(Error=, Array.<PBJS.Task>)}
 */
PBJS.prototype._fileSetToTaskMap = function (fileSet, cb) {
  var template = this.templates.pbjs.message;
  var root = this.outputRoot;
  var key;
  var result = {};
  for (key in fileSet.byPath) {
    var file = fileSet.byPath[key];
    var task = new PBJS.Task(file, root, template);
    var path = task.outputTarget;
    var i = 1;

    // Ensure no conflicts; we need to do this until we can merge tasks.
    while (result[path]) {
      ++i;
      path = task.outputTarget + '_' + i;
      // console.log('checking path ' + path);
    }
    task.outputPath = path + '.pb.js';

    // Cannot throw error since we might have multiple .proto files pointing
    //  to the same namespace.
    // if (result[path]) {
    //   return cb(new Error('Task output path conflict: '
    //     + 'existing ' + result[path]
    //     + '; new ' + task));
    // }

    result[path] = task;
    cli.log('[PBJS] Registering task... ' + task);
  }
  cb(null, result);
};

PBJS.prototype._buildTaskMap = function (inputRoot, cb) {
  return besync.waterfall(cb, [
    this._checkEmptyOutput,
    this._initTemplates,
    funct.dropAll,
    funct.injector(inputRoot),
    this._getProtoFileSet,
    this._fileSetToTaskMap,
  ], this);
};

PBJS.prototype._writeTaskFile = function (task, cb) {
  var outdata = task.build();
  var outpath = task.outputPath;
  var outdir = path.dirname(outpath);
  return besync.waterfall(cb, [
    funct.injector(outdir),
    mkdirp,
    fs.writeFile.bind(this, outpath, outdata, 'utf8')
  ]);
};

/**
 * Writes the given tasks, and passes on the resulting file list.
 * @param {Object.<string, PBJS.Task>} taskMap
 * @param {function(Error=, Array.<string>)} cb - passed the output file list.
 */
PBJS.prototype._writeTaskMapFiles = function (taskMap, cb) {
  var files = Object.keys(taskMap);
  var tasks = files.map(function(x){return taskMap[x];});
  var returnFn = function(err) {
    cb(err, tasks.map(function (task) {
      return task.outputPath;
    }));
  }
  besync.forEach(tasks, this._writeTaskFile, returnFn, this);
};

PBJS.prototype.build = function (inputRoot, cb) {
  return besync.waterfall(cb, [
    funct.injector(inputRoot),
    this._buildTaskMap,
    this._writeTaskMapFiles,
    this._cleanup
  ], this);
};

PBJS.prototype._cleanup = function (outputPaths, cb) {
  var doneFn = function(err) {
    cb(err, outputPaths);
  };
  if (this.opts.cleanup) {
    rimraf(this.soyset.options.tmpDir, doneFn);
  } else {
    doneFn();
  }
};

module.exports = PBJS;
