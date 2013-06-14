var should = require('shoulda');
var path = require('path');
var Parser = require('../parser/parser');

var ProtoFile = Parser.ProtoFile;
var Message = Parser.Message;

require('../pbjs/cli').ENABLED = false;

describe('protobuf.pegjs', function() {
  var parser = new Parser();
  var _parseTestProto = function(testFile, cb) {
    var relPath = path.join('test', 'abc',
      testFile + '.proto');
    parser.parseFile(relPath, cb);
  };

  it('initializes', function (done) {
    parser.init(done);
  });

  it('00 - parses an inline empty message', function (done) {
    parser.parseFileData('message EmptyMessage {}', function (err, result) {
      if (err) return done(err);
      result.should.be.instanceOf(ProtoFile, 'ProtoFile');
      result.messages.should.have.length(1);
      var msg = result.messages[0];
      msg.should.be.instanceOf(Message, 'Message');
      msg.name.should.equal('EmptyMessage');
      done();
    });
  });

  it('01 - parses an empty message file', function (done) {
    _parseTestProto('01_emptymessage', function (err, result) {
      if (err) return done(err);
      result.should.be.instanceOf(ProtoFile, 'ProtoFile');
      result.messages.should.have.length(1);
      var msg = result.messages[0];
      msg.should.be.instanceOf(Message, 'Message');
      msg.name.should.equal('EmptyMessage');
      msg.toString().should.equal('[message "EmptyMessage"]');
      done();
    });
  });

  it('02 - parses an empty message file with comments', function (done) {
    _parseTestProto('02_emptymessagewithcomment', function (err, result) {
      if (err) return done(err);
      result.should.be.instanceOf(ProtoFile, 'ProtoFile');
      result.messages.should.have.length(1);
      var msg = result.messages[0];
      msg.should.be.instanceOf(Message, 'Message');
      msg.name.should.equal('EmptyMessageWithComment');
      msg.toString().should.equal('[message "EmptyMessageWithComment"]');
      done();
    }, done);
  });

  it('03 - parses a message with fields', function (done) {
    _parseTestProto('03_simplemessage', function (err, result) {
      if (err) return done(err);
      result.should.be.instanceOf(ProtoFile);
      result.messages.should.have.length(1);
      var msg = result.messages[0];
      msg.should.be.instanceOf(Message, 'Message');
      msg.fields.should.have.length(3);

      msg.fields[0].rawType.should.equal('string');
      msg.fields[1].rawType.should.equal('string');
      msg.fields[2].rawType.should.equal('int32');

      msg.fields[0].label.should.equal('optional');
      msg.fields[1].label.should.equal('optional');
      msg.fields[2].label.should.equal('optional');

      msg.fields[0].tag.should.equal(1);
      msg.fields[1].tag.should.equal(2);
      msg.fields[2].tag.should.equal(3);

      msg.fields[0].name.should.equal('someData');
      msg.fields[1].name.should.equal('someMoreData');
      msg.fields[2].name.should.equal('someInt');

      done();
    }, done);
  });

  it('04 - parses a file with multiple messages', function (done) {
    _parseTestProto('04_multimessage', function (err, result) {
      if (err) return done(err);
      result.should.be.instanceOf(ProtoFile);
      result.messages.should.have.length(2);
      var msg1 = result.messages[0];
      var msg2 = result.messages[1];

      msg1.should.be.instanceOf(Message, 'Message');
      msg2.should.be.instanceOf(Message, 'Message');

      msg1.name.should.equal('MultiMessageOne');
      msg2.name.should.equal('MultiMessageTwo');

      msg1.fields.should.have.length(1);
      msg2.fields.should.have.length(1);

      var field1 = msg1.fields[0];
      var field2 = msg2.fields[0];

      field1.label.should.equal('optional');
      field2.label.should.equal('optional');

      field1.rawType.should.equal('string');
      field2.rawType.should.equal('string');

      field1.tag.should.equal(1);
      field2.tag.should.equal(1);

      field1.name.should.equal('someData');
      field2.name.should.equal('moreData');

      done();
    }, done);
  });

  it('05 - parses a file with nested messages', function (done) {
    _parseTestProto('05_nestedmessage', function (err, result) {
      if (err) return done(err);
      result.should.be.instanceOf(ProtoFile);
      result.messages.should.have.length(1);

      var msg = result.messages[0];
      msg.should.be.instanceOf(Message, 'Message');
      msg.name.should.equal('OuterMessage');
      msg.fields.should.have.length(3);
      msg.messages.should.have.length(1);

      var msg2 = msg.messages[0];
      msg2.should.be.instanceOf(Message, 'Message');
      msg2.name.should.equal('InnerMessage');
      msg2.fields.should.have.length(1);
      msg2.messages.should.have.length(1);

      var meat = msg2.messages[0];
      meat.name.should.equal('Meat');
      done();
    }, done);
  });

  // TODO(gregp): test fields whose names conflict
  // TODO(gregp): test fields whose tags conflict
  // TODO(gregp): test a nested message that has a name conflict with a field
  // TODO(gregp): ensure that a nested message which has a name conflict with
  //  a top-level message does not clobber the top-level message.

  it('06 - parses a file with enums', function (done) {
    _parseTestProto('06_enummessage', function (err, result) {
      if (err) return done(err);
      result.should.be.instanceOf(ProtoFile);
      var msg = result.messages[0];
      msg.name.should.equal('Dinner');
      msg.fields.should.have.length(2);
      msg.enums.should.have.length(1);
      var enm = msg.enums[0];
      msg.byName['MeatType'].should.equal(enm);
      Object.keys(msg.byName).should.eql(['sauce', 'meat', 'MeatType',
        'STEAK', 'MAHI_MAHI', 'CHICKEN', 'CALAMARI']);
      msg.parent.should.equal(result);
      enm.parent.should.equal(msg);
      done();
    }, done);
  });
  // TODO(gregp): test enum names that conflict with one another
  // TODO(gregp): test enum tags that conflict with one another
  // TODO(gregp): test enum names that conflict with the parent message
  // TODO(gregp): test enum tags that conflict with the parent message

  it('07 - parses a file with jsdoc', function (done) {
    _parseTestProto('07_documentation', function (err, result) {
      if (err) return done(err);
      result.should.be.instanceOf(ProtoFile);
      result.annotations.should.have.length(0);
      result.messages.should.have.length(2);
      var msg1 = result.messages[0];
      var msg2 = result.messages[1];
      msg1.annotations[0].data.should.include('@type {Model}');
      msg2.annotations[0].data.should.include('@type {Command}');
      msg1.fields.should.have.length(2);
      var field1 = msg1.fields[0];
      var field2 = msg1.fields[1];
      field1.should.equal(msg1.byName['sauce']);
      field1.annotations.should.have.length(0,
        "Don't retain non-jsdoc single-line comments.");
      field2.should.equal(msg1.byName['meat']);
      field2.annotations.should.have.length(0,
        "Don't retain non-jsdoc multi-line comments.");
      var MeatType = msg1.byName['MeatType'];
      MeatType.annotations.should.have.length(1);
      MeatType.entries.forEach(function(entry) {
        entry.annotations.should.have.length(1);
      });
      var STEAK = msg1.byName['STEAK'];
      STEAK.annotations.should.have.length(1);
      STEAK.annotations[0].data.should.include('@see http://');
      done();
    }, done);
  });

  it('08 - assigns fileoverview jsdoc properly', function (done) {
    _parseTestProto('08_docs2', function (err, result) {
      if (err) return done(err);
      result.annotations.should.have.length(1);
      result.annotations[0].data.should.include('@fileoverview');
      var FordT = result.byName['FordT'];
      FordT.annotations.should.have.length(1);
      done();
    }, done);
  });

  it('09 - assigns non-fileoverview jsdoc properly', function (done) {
    _parseTestProto('09_docs3', function (err, result) {
      if (err) return done(err);
      result.annotations.should.have.length(0);
      var Happy = result.byName['Happy'];
      Happy.annotations.should.have.length(1);
      done();
    }, done);
  });

  it('10 - parses file directives, options, imports', function (done) {
    _parseTestProto('10_filedirectives', function (err, result) {
      if (err) return done(err);
      // Note that we don't try to resolve the (broken) import statements
      //  since we're only running parseFile, not parseFileSet

      var javaPackageOpt = result.options['java_package'];
      should.exist(javaPackageOpt);
      var javaPackage = javaPackageOpt.value;
      should.exist(javaPackage);
      javaPackage.should.equal('com.pbjs.test.abc');

      var custom2Opt = result.options['custom_option_2'];
      should.exist(custom2Opt);
      var custom2 = custom2Opt.value;
      should.exist(custom2);
      custom2.should.equal(12.3456789);

      var custom4Opt = result.options['custom_option_4'];
      should.exist(custom4Opt);
      var custom4 = custom4Opt.value;
      should.exist(custom4);
      custom4.should.equal('Hello, "World"');

      var custom5Opt = result.options['custom_option_5'];
      should.exist(custom5Opt);
      var custom5 = custom5Opt.value;
      should.exist(custom5);
      custom5.should.equal('Hello\0World');

      var custom6Opt = result.options['custom_option_6'];
      should.exist(custom6Opt);
      var custom6 = custom6Opt.value;
      should.exist(custom6);
      custom6.should.equal("Hello\u1234World");

      var FileDirectives = result.byName['FileDirectives'];
      should.exist(FileDirectives);
      var id = FileDirectives.byName['id'];
      should.exist(id);
      should.exist(id.defaultValue);
      id.defaultValue.should.eql({val: "okay"});

      var FileDirectives = result.byName['FileDirectives'];
      should.exist(FileDirectives);
      var enumWithDefault = FileDirectives.byName['enumWithDefault'];
      should.exist(enumWithDefault);
      should.exist(enumWithDefault.defaultValue);
      enumWithDefault.defaultValue.should.eql({ref: "NestedEnum.ONE"});
      // Can't test resolution yet since we need multifile for that

      done();
    }, done);
  });

  it('11 - parses syntax slugs', function (done) {
    _parseTestProto('11_testpackagetypes', function (err, result) {
      if (err) return done(err);
      // TODO(gregp)
      done();
    }, done);
  });

  it('12 - parses testalltypes', function (done) {
    _parseTestProto('12_testalltypes', function (err, result) {
      if (err) return done(err);
      result.path.should.endWith('12_testalltypes.proto');
      should.exist(result.options['javascript_package']);
      var TestAllTypes = result.byName['TestAllTypes'];
      should.exist(TestAllTypes);
      TestAllTypes.byName.should.matchSet({
        '^NestedMessage$': 1,
        '^NestedEnum$': 1,
        '^FOO$': 1,
        '^BAR$': 1,
        '^BAZ$': 1,
        '^OptionalGroup$': 1,
        '^optional_nested_message$': 1,
        '^optional_nested_enum$': 1,
        '^RepeatedGroup$': 1,
        '^repeated_nested_message$': 1,
        '^repeated_nested_enum$': 1,
        '^optional_int32$': 1,
        '^optional_int64$': 1,
        '^optional_uint32$': 1,
        '^optional_uint64$': 1,
        '^optional_sint32$': 1,
        '^optional_sint64$': 1,
        '^optional_fixed32$': 1,
        '^optional_fixed64$': 1,
        '^optional_sfixed32$': 1,
        '^optional_sfixed64$': 1,
        '^optional_float$': 1,
        '^optional_double$': 1,
        '^optional_bool$': 1,
        '^optional_string$': 1,
        '^optional_bytes$': 1,
        '^repeated_int32$': 1,
        '^repeated_int64$': 1,
        '^repeated_uint32$': 1,
        '^repeated_uint64$': 1,
        '^repeated_sint32$': 1,
        '^repeated_sint64$': 1,
        '^repeated_fixed32$': 1,
        '^repeated_fixed64$': 1,
        '^repeated_sfixed32$': 1,
        '^repeated_sfixed64$': 1,
        '^repeated_float$': 1,
        '^repeated_double$': 1,
        '^repeated_bool$': 1,
        '^repeated_string$': 1,
        '^repeated_bytes$': 1
      });
      should.exist(TestAllTypes.byTag[1]);
      TestAllTypes.byTag[1].should.equal(TestAllTypes.byName['optional_int32']);
      should.exist(TestAllTypes.byTag[2]);
      TestAllTypes.byTag[2].should.equal(TestAllTypes.byName['optional_int64']);
      should.exist(TestAllTypes.byTag[3]);
      TestAllTypes.byTag[3].should.equal(TestAllTypes.byName['optional_uint32']);
      should.exist(TestAllTypes.byTag[4]);
      TestAllTypes.byTag[4].should.equal(TestAllTypes.byName['optional_uint64']);
      should.exist(TestAllTypes.byTag[5]);
      TestAllTypes.byTag[5].should.equal(TestAllTypes.byName['optional_sint32']);
      should.exist(TestAllTypes.byTag[6]);
      TestAllTypes.byTag[6].should.equal(TestAllTypes.byName['optional_sint64']);
      should.exist(TestAllTypes.byTag[7]);
      TestAllTypes.byTag[7].should.equal(TestAllTypes.byName['optional_fixed32']);
      should.exist(TestAllTypes.byTag[8]);
      TestAllTypes.byTag[8].should.equal(TestAllTypes.byName['optional_fixed64']);
      should.exist(TestAllTypes.byTag[9]);
      TestAllTypes.byTag[9].should.equal(TestAllTypes.byName['optional_sfixed32']);
      should.exist(TestAllTypes.byTag[10]);
      TestAllTypes.byTag[10].should.equal(TestAllTypes.byName['optional_sfixed64']);
      should.exist(TestAllTypes.byTag[11]);
      TestAllTypes.byTag[11].should.equal(TestAllTypes.byName['optional_float']);
      should.exist(TestAllTypes.byTag[12]);
      TestAllTypes.byTag[12].should.equal(TestAllTypes.byName['optional_double']);
      should.exist(TestAllTypes.byTag[13]);
      TestAllTypes.byTag[13].should.equal(TestAllTypes.byName['optional_bool']);
      should.exist(TestAllTypes.byTag[14]);
      TestAllTypes.byTag[14].should.equal(TestAllTypes.byName['optional_string']);
      should.exist(TestAllTypes.byTag[15]);
      TestAllTypes.byTag[15].should.equal(TestAllTypes.byName['optional_bytes']);
      should.exist(TestAllTypes.byTag[16]);
      TestAllTypes.byTag[16].should.equal(TestAllTypes.byName['OptionalGroup']);
      should.exist(TestAllTypes.byTag[17]);
      TestAllTypes.byTag[17].should.not.equal(TestAllTypes.byTag[47]); // Both named 'a'
      should.exist(TestAllTypes.byTag[18]);
      TestAllTypes.byTag[18].should.equal(TestAllTypes.byName['optional_nested_message']);
      should.exist(TestAllTypes.byTag[21]);
      TestAllTypes.byTag[21].should.equal(TestAllTypes.byName['optional_nested_enum']);
      should.exist(TestAllTypes.byTag[31]);
      TestAllTypes.byTag[31].should.equal(TestAllTypes.byName['repeated_int32']);
      should.exist(TestAllTypes.byTag[32]);
      TestAllTypes.byTag[32].should.equal(TestAllTypes.byName['repeated_int64']);
      should.exist(TestAllTypes.byTag[33]);
      TestAllTypes.byTag[33].should.equal(TestAllTypes.byName['repeated_uint32']);
      should.exist(TestAllTypes.byTag[34]);
      TestAllTypes.byTag[34].should.equal(TestAllTypes.byName['repeated_uint64']);
      should.exist(TestAllTypes.byTag[35]);
      TestAllTypes.byTag[35].should.equal(TestAllTypes.byName['repeated_sint32']);
      should.exist(TestAllTypes.byTag[36]);
      TestAllTypes.byTag[36].should.equal(TestAllTypes.byName['repeated_sint64']);
      should.exist(TestAllTypes.byTag[37]);
      TestAllTypes.byTag[37].should.equal(TestAllTypes.byName['repeated_fixed32']);
      should.exist(TestAllTypes.byTag[38]);
      TestAllTypes.byTag[38].should.equal(TestAllTypes.byName['repeated_fixed64']);
      should.exist(TestAllTypes.byTag[39]);
      TestAllTypes.byTag[39].should.equal(TestAllTypes.byName['repeated_sfixed32']);
      should.exist(TestAllTypes.byTag[40]);
      TestAllTypes.byTag[40].should.equal(TestAllTypes.byName['repeated_sfixed64']);
      should.exist(TestAllTypes.byTag[41]);
      TestAllTypes.byTag[41].should.equal(TestAllTypes.byName['repeated_float']);
      should.exist(TestAllTypes.byTag[42]);
      TestAllTypes.byTag[42].should.equal(TestAllTypes.byName['repeated_double']);
      should.exist(TestAllTypes.byTag[43]);
      TestAllTypes.byTag[43].should.equal(TestAllTypes.byName['repeated_bool']);
      should.exist(TestAllTypes.byTag[44]);
      TestAllTypes.byTag[44].should.equal(TestAllTypes.byName['repeated_string']);
      should.exist(TestAllTypes.byTag[45]);
      TestAllTypes.byTag[45].should.equal(TestAllTypes.byName['repeated_bytes']);
      should.exist(TestAllTypes.byTag[46]);
      TestAllTypes.byTag[46].should.equal(TestAllTypes.byName['RepeatedGroup']);
      should.exist(TestAllTypes.byTag[48]);
      TestAllTypes.byTag[48].should.equal(TestAllTypes.byName['repeated_nested_message']);
      should.exist(TestAllTypes.byTag[49]);
      TestAllTypes.byTag[49].should.equal(TestAllTypes.byName['repeated_nested_enum']);
      should.exist(TestAllTypes.byName['NestedMessage']);
      done();
    }, done);
  });

  it('13 - parses custom options and extends', function (done) {
    _parseTestProto('13_protobufoptions', function (err, result) {
      if (err) return done(err);
      // TODO(gregp): check stuff got registered properly...
      done();
    }, done);
  });

  describe('enforcer', function () {
    it('is okay with no enforcements', function (done) {
      parser.opts.enforceJsDocs = [];
      _parseTestProto('07_documentation', function (err, result) {
        if (err) return done(err);
        done();
      });
    });

    it('is okay with the enforcements it has', function (done) {
      parser.opts.enforceJsDocs = ['message', 'enum', 'enum_entry'];
      _parseTestProto('07_documentation', function (err, result) {
        if (err) return done(err);
        done();
      });
    });

    it('fails when we check field jsdocs', function (done) {
      parser.opts.enforceJsDocs = ['message', 'field', 'enum', 'enum_entry'];
      _parseTestProto('07_documentation', function (err, result) {
        if (!err) return done(
          new Error('Should have failed since a field has no jsdoc.'));
        done();
      });
    });
  });
});
