var util = require('util');

var Enum = require('./enum');
var EnumEntry = require('./enum_entry');
var Field = require('./field');
var Message = require('./message').Message;
var Option = require('./option');
var ProtoFile = require('./protofile');
var ProtoFileSet = require('./protofileset');
var ValidationError = require('./shared').ValidationError;


/**
 * @constructor
 */
var JSDocEnforcerError = function (item) {
  var msg = 'No JSDoc on mandatory item: ' + item;
  while (item = item.parent) {
    msg += ', of ' + item;
  }
  ValidationError.call(this, msg);
};
util.inherits(JSDocEnforcerError, ValidationError);

var _checkAnnotations = function(opts, curKey, item) {
  // console.log('ENFORCEMENT: ', opts, '' + item);
  if (opts.indexOf(curKey) === -1) {
    return;
  }
  if (item.annotations.length === 0) {
    throw new JSDocEnforcerError(item);
  }
};

var _enforceField = function (opts, field) {
  _checkAnnotations(opts, 'field', field);
};

var _enforceEnumEntry = function (opts, entry) {
  _checkAnnotations(opts, 'enum_entry', entry);
};

var _enforceEnum = function (opts, en_m) {
  _checkAnnotations(opts, 'enum', en_m);
  en_m.entries.forEach(_enforce.bind(this, opts));
};

var _enforceMessage = function (opts, message) {
  _checkAnnotations(opts, 'message', message);
  message.messages.forEach(_enforce.bind(this, opts));
  message.fields.forEach(_enforce.bind(this, opts));
  message.enums.forEach(_enforce.bind(this, opts));
};

var _enforceFile = function (opts, protoFile) {
  _checkAnnotations(opts, 'file', protoFile);
  protoFile.messages.forEach(_enforce.bind(this, opts));
};

var _enforceFileSet = function (opts, protoFileSet) {
  protoFileSet.files.forEach(_enforce.bind(this, opts));
};

var _enforce = function (opts, item) {
  if (item instanceof ProtoFileSet) {
    _enforceFileSet(opts, item);
  } else if (item instanceof ProtoFile) {
    _enforceFile(opts, item);
  } else if (item instanceof Enum) {
    _enforceEnum(opts, item);
  } else if (item instanceof Message) {
    _enforceMessage(opts, item);
  } else if (item instanceof EnumEntry) {
    _enforceEnumEntry(opts, item);
  } else if (item instanceof Field) {
    _enforceField(opts, item);
  } else {
    throw new Error('Unrecognized item to enforce jsdocs on: ' + item);
  }
  return item;
};


var enforce = function (opts, item, cb) {
  // console.log(opts);
  try {
    _enforce(opts || [], item);
    return cb(null, item);
  } catch (err) {
    return cb(err);
  }
};

// TODO(gregp): convert to an object that keeps its options
module.exports = enforce;
