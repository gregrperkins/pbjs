var Field = require('./field');
var Extend = require('./extend');
var Option = require('./option');
var Enum = require('./enum');
var util = require('util');
var DescriptorItem = require('./shared').DescriptorItem;
var ValidationError = require('./shared').ValidationError;

/**
 * A Protobuf Message
 * @param {Object} data - A map of possible attributes for this Message
 * @constructor
 */
var Message = function(data) {
  /**
   * The name of the message.
   * @type {!string}
   */
  this.name = data.name;

  /**
   * Fields in the protobuf message.
   * @type {!Array.<Field>}
   */
  this.fields = [];

  /**
   * Enums defined on the message.
   * @type {!Array.<Enum>}
   */
  this.enums = [];

  /**
   * Sub-messages defined on the message.
   * @type {!Array.<Message>}
   */
  this.messages = [];

  /**
   * Groups of fields defined on the message.
   * @type {!Array.<Group>}
   */
  this.groups = [];

  /**
   * Maps field tag numbers to Field objects.
   * @type {!Object.<number, Field>}
   */
  this.byTag = {};

  /**
   * Maps names in the namespace to items.
   * @type {!Object.<string, DescriptorItem>}
   */
  this.byName = {};

  DescriptorItem.call(this);
  this.registerAll(data.items || []);
};
util.inherits(Message, DescriptorItem);

/**
 * Ensures that a field does not conflict with other fields
 *  or items on this Message.
 * @param {Field} field
 */
Message.prototype._validateField = function(field) {
  var name = field.name;
  if (this.byName[name]) {
    throw new ValidationError('Duplicate field with name ' + name
      + ' in ' + this.name, this, field);
  }
  var tag = field.tag;
  if (this.byTag[tag]) {
    throw new ValidationError('Duplicate field with tag ' + tag
      + ' in ' + this.name, this, field);
  }
};

/**
 * Ensures that there is no name conflict for incoming messages
 * @param {Message} msg
 */
Message.prototype._validateMessage = function(msg) {
  var name = msg.name;
  if (this.byName[name]) {
    throw new ValidationError('Duplicate msg with name ' + name
      + ' in ' + this.name, this, msg);
  }
};

/**
 * Ensures that there is no conflict for incoming groups
 *  groups do not define an isolated context, so we check tag uniqueness
 * @param {Message} msg
 */
Message.prototype._validateGroup = function(group) {
  var name = group.name;
  if (this.byName[name]) {
    throw new ValidationError('Duplicate group with name ' + name
      + ' in ' + this.name, this, group);
  }
  var tag = group.tag;
  if (this.byTag[tag]) {
  throw new ValidationError('Duplicate group with tag ' + tag
      + ' in ' + this.name, this, group);
  }

  var tag, child;
  for (tag in group.byTag) {
    if (this.byTag[tag]) {
      child = group.byTag[tag];
      throw new ValidationError('Duplicate item with tag ' + tag
        + ' in ' + this.name, this, child)
    }
  }
};

/**
 * Ensures that an enum does not conflict with other items on this Message.
 * Note that both the enum itself, and each of its entries, must all be
 *  unique by name in this object.
 * @param {Enum} enm
 */
Message.prototype._validateEnum = function(enm) {
  var name = enm.name;
  if (this.byName[name]) {
    throw new ValidationError('Duplicate enum with name ' + name
      + ' in ' + this.name, this, enm);
  }
  var entries = enm.entries;
  for (var i = 0, i_len = entries.length; i < i_len; ++i) {
    var entry = entries[i];
    name = entry;
    if (this.byName[name]) {
      throw new ValidationError('Duplicate enum entry with name ' + name
        + ' on ' + enm.name
        + ' in ' + this.name, this, enm);
    }
  }
};

/**
 * Puts the item in its proper bucket.
 * @param {Message|Enum|Field} item
 */
Message.prototype.register = function(item) {
  if (item instanceof Field) {
    this._validateField(item);
    this.byName[item.name] = item;
    this.byTag[item.tag] = item;
    this.fields.push(item);
    item.parent = this;
    return;
  }
  if (item instanceof Enum) {
    this._validateEnum(item);
    this.byName[item.name] = item;
    this.enums.push(item);
    var entries = item.entries;
    for (var i = 0, i_len = entries.length; i < i_len; ++i) {
      var entry = entries[i];
      this.byName[entry.name] = entry;
    }
    item.parent = this;
    return;
  }
  if (item instanceof Option) {
    return; // TODO(gregp): process message options
  }
  if (item instanceof Extend) {
     return;
  }
  if (item === '') {
    return;
  }

  if (item instanceof Group) {
    this._validateGroup(item);
    this.byName[item.name] = item;
    this.byTag[item.tag] = item;
    this.messages.push(item);
    this.groups.push(item);
    // this.fields.push(item); // FIXME(gregp)
    var tag, child;
    for (tag in item.byTag) {
      child = item.byTag[tag];
      this.byTag[tag] = child;
      // grouped items do not lend names, only tags
    }
    item.parent = this;
    return;
  }
  if (item instanceof Message) {
    this._validateMessage(item);
    this.byName[item.name] = item;
    this.messages.push(item);
    item.parent = this;
    return;
  }

  // TODO(gregp): option
  // TODO(gregp): extend
  // TODO(gregp): extension
  DescriptorItem.prototype.register.call(this, item);
};

Message.prototype.toString = function() {
  return '[' + this.CLASS + ' ' + this.toString_() + ']';
};

Message.prototype.CLASS = "message";

Message.prototype.toString_ = function() {
  return '"' + this.name + '"';
};

/**
 * Override to allow for building fullName's that do not include namespaces.
 *  If we're at the top of a given Message heierarchy, we should return our
 *  name naked of namespace. Otherwise, just call DescriptorItem's base fn.
 *
 * @param {boolean=} opt_ignoreNamespaces - Used for fullName
 * @return {string}
 *
 * @override
 */
Message.prototype.jsPath = function (opt_ignoreNamespaces) {
  if (opt_ignoreNamespaces && !(this.parent instanceof Message)) {
    return this.name;
  }
  return DescriptorItem.prototype.jsPath.call(this, opt_ignoreNamespaces);
};



/**
 * A Protobuf Group of Fields, that also acts like a field.
 * @param {Object} data - A map of possible attributes for this Group
 * @constructor
 */
var Group = function(data) {
  /**
   * @type {!LABEL}
   */
  this.label = data.label;

  /**
   * The tag number
   * @type {!number}
   */
  this.tag = data.tag;

  Message.call(this, data);
};
util.inherits(Group, Message);

Group.prototype.CLASS = "group";


module.exports = {
  Message: Message,
  Group: Group,
};
