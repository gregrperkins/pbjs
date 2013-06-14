var should = require('shoulda');
var path = require('path');
var Parser = require('../parser/parser');

require('../pbjs/cli').ENABLED = false;

describe('multifile parser', function() {
  before(function() {
    this.parser = new Parser();
  });

  it('initializes', function (done) {
    this.parser.init(done);
  });

  it('parseFileSet runs properly', function (done) {
    var root = path.join('test', 'eg01');
    this.parser.parseFileSet(root, function (err, results) {
      if (err) return done(err);
      results.should.be.instanceOf(Parser.ProtoFileSet);
      results.files.should.have.length(3);
      var relPaths = results.files.map(function (protoFile) {
        return protoFile.path;
      });
      var expectations = {
        'javascript/closure/package_test.proto$': 1,
        'javascript/closure/test.proto$': 1,
        'javascript/closure/test2.proto$': 1,
      };
      relPaths.should.matchSet(expectations);
      results.byPath.should.matchSet(expectations);
      done();
    });
  });

  it('parseFileSet throws ImportError', function (done) {
    var root = path.join('test', 'err01');
    this.parser.parseFileSet(root, function (err, results) {
      if (!err) return done(new Error('Should have thrown an import error.'));
      err.should.be.instanceOf(Parser.ImportError);
      done();
    });
  });

  it('parseFileSet resolves imports', function (done) {
    var root = path.join('test', 'eg01');
    this.parser.parseFileSet(root, function (err, results) {
      if (err) return done(err);
      var rel = 'javascript/closure/';
      var TestProto = results.byPath[rel + 'test.proto'];
      var PackageTestProto = results.byPath[rel + 'package_test.proto'];
      should.exist(TestProto);
      TestProto.parent.should.equal(results);
      should.exist(PackageTestProto);
      PackageTestProto.imports.should.have.length(2);
      TestProto.jsNamespace.should.equal('proto2');
      PackageTestProto.jsNamespace.should.equal('someprotopackage');
      var impt = PackageTestProto.imports[0];
      PackageTestProto.imports[1].ref.should.equal(TestProto);
      done();
    });
  });

  it('builds namespace okay', function (done) {
    var root = path.join('test', 'eg02');
    this.parser.parseFileSet(root, function (err, results) {
      if (err) return done(err);
      var rel = 'javascript/closure/';
      var ns = results.namespace;
      Object.keys(ns.byName).should.have.length(2);
      var TestProto = results.byPath[rel + 'test.proto'];
      var PackageTestProto = results.byPath[rel + 'package_test.proto'];

      Parser.Namespace.UNSAFE_RESOLUTION = true;
      var jsCloTest = ns.resolve(['javascript', 'closure', 'test']);
      var someprotopackage = ns.resolve(['someprotopackage']);
      Parser.Namespace.UNSAFE_RESOLUTION = false;
      someprotopackage.byName.should.matchSet({
        '^TestPackageTypes$': 1,
        '^TestAllTypes$': 1,
      });
      jsCloTest.byName.should.matchSet({
        '^TestAllTypes$': 1,
      });

      // jsCloTest.files.should.have.length(1);
      // jsCloTest.files[0].should.equal(TestProto);
      // someprotopackage.files.should.have.length(1);
      // someprotopackage.files[0].should.equal(PackageTestProto);

      done();
    });
  });

  it('recognizes types okay', function (done) {
    var root = path.join('test', 'eg02');
    this.parser.parseFileSet(root, function (err, results) {
      if (err) return done(err);
      var rel = 'javascript/closure/';
      var ns = results.namespace;

      Parser.Namespace.UNSAFE_RESOLUTION = true;
      var jsCTest = ns.resolve(['javascript', 'closure', 'test']);
      Parser.Namespace.UNSAFE_RESOLUTION = false;

      var TestProto = results.byPath[rel + 'test.proto'];
      var PackageTestProto = results.byPath[rel + 'package_test.proto'];
      var pt_TestAllTypes = PackageTestProto.byName['TestAllTypes'];
      var t_TestAllTypes = TestProto.byName['TestAllTypes'];
      should.exist(pt_TestAllTypes);
      should.exist(t_TestAllTypes);
      t_TestAllTypes.should.not.equal(pt_TestAllTypes);
      var There = pt_TestAllTypes.byName['There'];
      should.exist(There);
      var outThere = There.byName['out'];
      should.exist(outThere);
      outThere.tag.should.equal(1);
      should.exist(outThere.type);
      outThere.type.should.be.instanceOf(Parser.CustomType)
      outThere.type.src.should.equal(t_TestAllTypes);

      // TODO(gregp): try enum TestAllTypes
      var NestedEnum = t_TestAllTypes.byName['NestedEnum'];
      var optional_nested_enum = t_TestAllTypes.byName['optional_nested_enum'];
      should.exist(optional_nested_enum.defaultValue);
      var o_n_e_dfault_src = optional_nested_enum.defaultValue.src;
      should.exist(o_n_e_dfault_src);
      o_n_e_dfault_src.should.equal(NestedEnum.byName['BAZ']);

      done();
    });
  });

  it('recognizes implied file namespace conflicts', function (done) {
    var root = path.join('test', 'err02');
    this.parser.parseFileSet(root, function (err, results) {
      // Since the test.proto file implicitly claims the
      //  .javascript.closure.test.TestAllTypes namespace, we conflict
      //  when adding TestAllTypes from closure/test.proto, given the
      //  "package javascript.closure.test;" directive in that file.
      if (!err) return done(
        new Error('Should have recognized namespace conflict.'));
      done();
    });
  });

  it('finds illegal file resolve error', function (done) {
    var root = path.join('test', 'eg02');
    this.parser.parseFileSet(root, function (err, results) {
      if (err) return done(err);
      (function() {
        results.namespace.resolve(['javascript', 'closure', 'test']);
      }).should.throwError(/Cannot resolve a namespace/);
      done();
    });
  });

  it('resolve not found to null', function (done) {
    var root = path.join('test', 'eg02');
    this.parser.parseFileSet(root, function (err, results) {
      if (err) return done(err);
      var no = results.namespace.resolve(['javascript', 'closure', 'testy']);
      should.equal(no, null);
      done();
    });
  });

  it('finds resolve failure error', function (done) {
    var root = path.join('test', 'err03');
    this.parser.parseFileSet(root, function (err, results) {
      err.message.should.match(/Could not resolve Here\.TestBreak/);
      done();
    });
  });

  it('throws when no files are found', function (done) {
    var root = path.join('test', 'noap');
    this.parser.parseFileSet(root, function (err) {
      if (!err) return done(
        new Error('Should have given an error when finding no files.'));
      done();
    })
  });

  it('resolves types', function (done) {
    var root = path.join('test', 'eg01');
    this.parser.parseFileSet(root, function (err, results) {
      if (err) return done(err);
      var rel = 'javascript/closure/';
      var PackageTestProto = results.byPath[rel + 'package_test.proto'];
      var TestProto = results.byPath[rel + 'test.proto'];
      should.exist(PackageTestProto);
      var TestPackageTypes = PackageTestProto.byName['TestPackageTypes'];
      should.exist(TestPackageTypes);
      TestPackageTypes.fields.should.have.length(2);
      var other_all = TestPackageTypes.byName['other_all'];
      other_all.tag.should.equal(2);
      other_all.rawType.should.equal('TestAllTypes');
      // other_all.type.name.should.equal('proto2.TestAllTypes');
      should.exist(TestProto);
      done();
    })
  });

  // TODO(gregp): multiple roots
});
