/**
 * We create the various object types inline during parsing in order to
 *  keep validation and dereference logic in pure javascript.
 */
{
  var Parser;
  try {
    // For embedded use within other projects
    Parser = require('pbjs-compiler/parser/parser');
  } catch (err) {
    // For standalone installations of pbjs, we expect to be running at:
    //  pbjs-compiler/node_modules/pegjs/pegjs/
    Parser = require('../../../parser/parser');
  }

  var Annotation = Parser.Annotation;
  var DescriptorItem = Parser.DescriptorItem; // unused
  var Enum = Parser.Enum;
  var EnumEntry = Parser.EnumEntry;
  var Field = Parser.Field;
  var Group = Parser.Group;
  var Import = Parser.Import;
  var Message = Parser.Message;
  var Extend = Parser.Extend;
  var Option = Parser.Option;
  var Package = Parser.Package;
  var ProtoFile = Parser.ProtoFile;
  var ValidationError = Parser.ValidationError; // unused

  var flattenStr = function(args) {
    if (args.map) {
      args = args.map(flattenStr);
      var out = args.join('');
      return out;
    } else {
      return args;
    }
  }
}

/**
 * The entire parsed entity is the .proto file.
 */
start
  = PROTO_FILE

/**
 * The .proto file consists of just a single message so far.
 */
PROTO_FILE
  = _ items:(PROTO_FILE_STATEMENT)*
    _
  {
    return new ProtoFile({
      items: items
    });
  }

/**
 * The statements that can appear at the top level of a .proto file.
 * We match jsdoc with @ fileoverview first.
 * We match messages before standard jsdoc so that if the first jsdoc is
 *  attached to a message we keep the annotations properly.
 */
PROTO_FILE_STATEMENT
  = FILE_JS_DOC
  / FILE_DIRECTIVE
  / MESSAGE
  / EXTEND
  / JS_DOC
  ////

/**
 * JSDoc style documentation
 */
JS_DOC
  = _ "/**" contents:JS_DOC_CHAR* "*/" _
  {
    return new Annotation(contents.join(''));
  }

/**
 * Docs that contain @fileoverview must be attached to the file,
 *  and not to a directive or mesage within the file.
 */
FILE_JS_DOC
  = doc:JS_DOC
  {
    if (doc.data.indexOf('@fileoverview') == -1) {
      return null; // no match
    } else {
      return doc;
    }
  }

/**
 * A single character of a jsdoc; must not be a jsdoc ending token.
 */
JS_DOC_CHAR
  = ( !"*/" val:. )
  {
    return val;
  }

///////////////////////////////////////////////////////////////////////////////
/**
 * File directives
 * TODO(gregp): files can contain ENUM's, apparently...
 */
FILE_DIRECTIVE
  = _ doc:JS_DOC?
    _ item:(FILE_OPTION / FILE_PACKAGE / FILE_IMPORT / SYNTAX_SLUG )
    _
  {
    if (doc) {
      item.register(doc);
    }
    return item;
  }

FILE_OPTION
  = _ "option"
    _ key:FILE_OPTION_KEY
    _ "="
    _ val:LITERAL
    _ ";"
    _
  {
    var result = new Option({
      key: key,
      value: val
    });
    return result;
  }

FILE_OPTION_KEY
  = BUILTIN_FILE_OPTION_KEYWORD / CUSTOM_OPTION

BUILTIN_FILE_OPTION_KEYWORD
  = "java_package"
  / "java_outer_classname"
  / "java_multiple_files"
  / "java_generate_equals_and_hash"
  / "javascript_package"
  / "optimize_for"
  / "cc_generic_services"
  / "java_generic_services"
  / "py_generic_services"
  ////

// TODO(gregp): options can be references to enum types,
//  ENUM_TYPE_REFERENCE, see unittest_custom_options.proto:195
// Copy logic from FIELD_DEFAULT pathway

/**
 * TODO(gregp): custom options can be like:
 *  (complex_opt2).bar.(protobuf_unittest.corge).qux
 *  per unittest_custom_options.proto:272
 */

CUSTOM_OPTION
  = '(' keyword:IDENTIFIER ')'
  {
    return keyword;
  }

FILE_PACKAGE
  = _ "package" _ str:NAMESPACED_IDENTIFIER ";" _
  {
    return new Package(str);
  }

FILE_IMPORT
  = _ "import" _ str:STRING_LITERAL _ ";" _
  {
    return new Import(str);
  }

SYNTAX_SLUG
  = _ "syntax" _ "=" _ '"proto2"' _ ";" _
  {
    return ''
  }

/**
 * A message extension looks exactly like a message, except it can have pathed
 *  identifiers, and is stored differently.
 */
EXTEND
  = _ annotations:(JS_DOC)*
    _ "extend"
    _ name:NAMESPACED_IDENTIFIER
    _ "{" body:MESSAGE_BODY "}"
    _
  {
    return new Extend({
      annotations: annotations,
      items: body,
      name: name,
    });
  }

EXTENSIONS
  = _ "extensions"
    _ INTEGER_LITERAL
    _ "to"
    _ ("max" / INTEGER_LITERAL)
    _ ";"
    _
  {
    return "";
  }


/**
 * A message consists of the message keyword, an identifier, and the body.
 */
MESSAGE
  = _ annotations:(JS_DOC)*
    _ "message"
    _ name:IDENTIFIER
    _ "{" body:MESSAGE_BODY "}"
    _
  {
    return new Message({
      items: body.concat(annotations),
      name: name
    });
  }

/**
 * The message body can contain whitespace and message body statements
 */
MESSAGE_BODY
  = _ items:(MESSAGE_BODY_STATEMENT*) _
  {
    return items;
  }

MESSAGE_BODY_STATEMENT
  = _ annotation:(JS_DOC?)
    _ item:(MESSAGE / MESSAGE_FIELD / ENUM / GROUP / MESSAGE_OPTION / EXTENSIONS / EXTEND)
    _
  {
    if (annotation) {
      item.register(annotation);
    }
    return item;
  }

MESSAGE_OPTION
  = _ "option"
    _ key:MESSAGE_OPTION_KEY
    _ "="
    _ val:LITERAL
    _ ";"
    _
  {
    // TODO(gregp): handle non-literal (enum) values
    var result = new Option({
      key: key,
      value: val,
      // TODO(gregp): split ref vs. val
    });
    return result;
  }

MESSAGE_OPTION_KEY
  = BUILTIN_MESSAGE_OPTION_KEYWORD / CUSTOM_OPTION

BUILTIN_MESSAGE_OPTION_KEYWORD
  = "message_set_wire_format" /
    "default" / 
    "packed"
  / "no_standard_descriptor_accessor"
  ////

GROUP
  = _ label:FIELD_LABEL
    _ "group"
    _ name:NAMESPACED_IDENTIFIER
    _ "="
    _ tag:TAG_NUM
    _ "{" fields:(MESSAGE_FIELD*) "}"
    _
  {
    return new Group({
      items: fields,
      label: label,
      name: name,
      tag: tag
    })
  }

ENUM
  = _ "enum"
    _ name:IDENTIFIER
    _ "{" items:(ENUM_ENTRY*) "}" 
    _ ";"?
    _
  {
    return new Enum({
      items: items,
      name: name
    });
  }

ENUM_ENTRY
  = _ annotations:(JS_DOC)*
    _ name:IDENTIFIER
    _ "="
    _ tag:TAG_NUM
    _ ";"
    _
  {
    return new EnumEntry({
      items: annotations,
      name: name,
      tag: tag
    });
  }

MESSAGE_FIELD
  = _ label:FIELD_LABEL
    _ type:NAMESPACED_IDENTIFIER
    _ name:IDENTIFIER
    _ "="
    _ tag:TAG_NUM
    _ defaultValue:(FIELD_DEFAULT)?
    _ options:(MSG_FIELD_OPTION)*
    _ ";"
    _
  {
    var field = {
      defaultValue: defaultValue || null,
      label: label,
      name: name,
      tag: tag,
      type: type
    };
    return new Field(field);
  }

FIELD_LABEL
  = "required"
  / "optional"
  / "repeated"
  ////

NAMESPACED_IDENTIFIER
  = head:(IDENTIFIER / DOT_IDENTIFIER) tail:(DOT_IDENTIFIER)*
  {
    var str = head + tail.join('');
    if (str.indexOf('.') == 0) str = str.slice(1);
    return (str === '.') ? null : str;
  }

TAG_NUM
  = INTEGER_LITERAL

MSG_FIELD_OPTION
  = _ "["
    _ key:MESSAGE_OPTION_KEY
    _ "="
    _ val:LITERAL
    _ "]"
    _
  {
    // TODO(gregp): handle non-literal (enum) field option values
    var result = new Option({
      key: key,
      value: val,
      // TODO(gregp): split ref vs. val
    });
    return result;
  }

FIELD_DEFAULT
  = _ "["
    _ "default"
    _ "="
    _ ret:(FIELD_DEFAULT_LITERAL / FIELD_DEFAULT_ENUM)
    _ "]"
    _
  {
    return ret;
  }

FIELD_DEFAULT_LITERAL
  = val:LITERAL
  {
    return {val: val};
  }

FIELD_DEFAULT_ENUM
  = ref:NAMESPACED_IDENTIFIER
  {
    return {ref: ref};
  }

DOT_IDENTIFIER
  = arr:('.' IDENTIFIER)
  {
    return arr.join('');
  }


IDENTIFIER
  = head:[A-Za-z_] tail:[A-Za-z0-9_]*
  {
    return head + tail.join("");
  }

/**
 * Non-line-breaking whitespace.
 * TODO(gregp) includes unicode chars from JS whitespace unnecessarily?
 */
WHITESPACE "whitespace"
  = [\t\v\f \u00A0\uFEFF]
  / [\u0020\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000]
  ////

/**
 * Sequence of characters that denotes a line termination, mainly used for the
 *  purpose of ending a single line comment.
 */
LINE_TERMINATOR_SEQUENCE "linebreak"
  = "\r\n"
  / "\n"
  / "\r"
  ////

/**
 * A single line comment is a double forward slash followed by anything
 *  non-line-terminating.
 * TODO(gregp): do we want to retain these for doc purposed?
 */
SINGLE_LINE_COMMENT
  = "//" (!LINE_TERMINATOR_SEQUENCE .)*

/**
 * A non-jsdoc block comment is /* followed by any non-star character
 */
BLOCK_COMMENT_NON_JSDOC
  = "/*" !"*" (!"*/" .)* "*/"

/**
 * Whitespace, with line breaks and comments.
 * TODO(gregp): need to ensure jsdoc gets higher priority.
 */
_
  = ( WHITESPACE
    / LINE_TERMINATOR_SEQUENCE
    / SINGLE_LINE_COMMENT
    / BLOCK_COMMENT_NON_JSDOC
    ////
    )*

LITERAL
  = BOOL_LITERAL
  / STRING_LITERAL
  / FLOAT_LITERAL
  / INTEGER_LITERAL
  ////

// Integer ----------------------------
INTEGER_LITERAL
  = match:( HEX_HEAD HEX_DIGIT+
    / OCTAL_HEAD OCTAL_DIGIT+
    / DECIMAL_HEAD DECIMAL_DIGIT* )
    ////
  {
    var str = match[0].concat(match[1]).join('');
    return parseInt(str);
  }
HEX_DIGIT
  = [0-9a-fA-F]
HEX_HEAD
  = '-'? '0' 'x'i
OCTAL_DIGIT
  = [0-7]
OCTAL_HEAD
  = '-'? '0'
DECIMAL_DIGIT
  = [0-9]
DECIMAL_HEAD
  = (!{} '0') / ('-'? [1-9])
// Integer ----------------------------

// String -----------------------------
STRING_LITERAL
  = '"' chars:(STRING_CHAR)* '"'
  {
    return chars.join('');
  }
STRING_CHAR
  = ESCAPE_SEQUENCE / STRING_CHAR_ORDINARY
STRING_CHAR_ORDINARY
  = ( !('\\' / '"' / '\n' / '\r') val:. )
  {return val;}
ESCAPE_SEQUENCE
  = '\\' val:( CHAR_ESCAPE / OCTAL_ESCAPE / UNICODE_ESCAPE )
  {return val;}
CHAR_ESCAPE
  = esc:( 'b' / 't' / 'n' / 'f' / 'r' / '\"' / '\'' / '\\' )
  {
    switch (esc) {
      case "b": return "\b";
      case "t": return "\t";
      case "n": return "\n";
      case "f": return "\f";
      case "r": return "\r";
      default: return esc;
    }
  }
OCTAL_ESCAPE
  = arr:( [0-3] [0-7] [0-7] / [0-7] [0-7] / [0-7] )
  {
    var raw = arr.length == 1 ? [arr] : arr.join('');
    var str = String.fromCharCode(parseInt(raw, 8));
    return str;
  }
// Note that this does not handle UCS-4; use surrogate pair explicitly
UNICODE_ESCAPE
  = 'u' arr:( HEX_DIGIT HEX_DIGIT HEX_DIGIT HEX_DIGIT )
  {
    return String.fromCharCode(parseInt(arr.join(''), 16));
  }
// String -----------------------------

// Bool -------------------------------
BOOL_LITERAL
  = str:( 'true'/ 'false' )
  ////
  {
    return 'true' === str;
  }
// Bool -------------------------------

// Float-------------------------------
FLOAT_LITERAL
  = str:( '-'?
      ( [0-9]+ '.' [0-9]* EXPONENT?
      / '.' [0-9]+ EXPONENT?
      / [0-9]+ EXPONENT
      ) )
  {
    return parseFloat(flattenStr(str));
  }
EXPONENT
  = 'e'i ('+' / '-')? [0-9]+
// Float-------------------------------
