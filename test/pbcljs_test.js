var should = require('shoulda');
var path = require('path');
var async = require('async');
var besync = require('besync');
var funct = require('funct');
var fs = require('fs');
var Parser = require('../parser/parser');
var PBJS = require('..');
var JSON2 = require('JSON2');

require('../pbjs/cli').ENABLED = false;

describe('pbcljs', function () {
  before(function (done) {
    this.pbjs = new PBJS({
      outputRoot: './.pb_js_test'
    });
    this.root = './test/proto2_closure_library_ex/in';
    this.pbjs.clean(done);
  });

  it('is', function () {
    should.exist(this.pbjs);
    this.pbjs.templateRoot.should.endWith('templates');
    this.pbjs.outputRoot.should.equal(path.resolve('./.pb_js_test'));
  });

  it('constructs & checks templates', function (done) {
    this.pbjs._getTemplates(function (err, templates) {
      if (err) return done(err);
      var result = templates.pbjs.test({
        protoFile: {
          path: "/here"
        }
      });
      result.should.be.a('string');
      result.should.equal('NO MESSAGE/here');
      done();
    });
  });

  it('gets expected ProtoFileSet', function (done) {
    this.pbjs._getProtoFileSet(this.root, function (err, protoFileSet) {
      if (err) return done(err);
      should.exist(protoFileSet);
      should.exist(protoFileSet.byPath);
      protoFileSet.byPath.should.matchSet({
        '^package_test.proto$': 1,
        '^javascript/closure/proto2/test.proto$': 1,
      });
      Object.keys(protoFileSet.byPath).should.have.length(2);

      // Check file interconnections
      var Test = protoFileSet.byPath['javascript/closure/proto2/test.proto'];
      var PackageTest = protoFileSet.byPath['package_test.proto'];
      Test.imports.should.have.length(0);
      PackageTest.imports.should.have.length(1);
      PackageTest.imports[0].ref.should.equal(Test);
      var oall = PackageTest.byName['TestPackageTypes'].byName['other_all'];
      oall.type.src.should.equal(Test.byName['TestAllTypes']);

      // Check file package expectations
      Test.jsNamespace.should.equal('proto2');
      PackageTest.jsNamespace.should.equal('someprotopackage');

      // Ensure that the packagePath() and jsPath() are as expected.
      var TestAllTypes = Test.byName['TestAllTypes'];
      var TestPackageTypes = PackageTest.byName['TestPackageTypes'];
      TestAllTypes.packagePath().should.equal('TestAllTypes');
      TestAllTypes.jsPath().should.equal('proto2.TestAllTypes');
      TestPackageTypes.packagePath().should.equal(
        'someprotopackage.TestPackageTypes');
      TestPackageTypes.jsPath().should.equal(
        'someprotopackage.TestPackageTypes');
      done();
    });
  });

  var expectErr = function (elseErr, fn) {
    return function () {
      var args = [].slice.call(arguments);
      var next = args.pop();
      args.push(function (expectedErr) {
        if (!expectedErr) {
          fn(elseErr);
        } else {
          fn();
        }
      });
      fn.apply(this, args);
    };
  };

  it('checks directories and cleans', function (done) {
    var mkdirFn = function() {
      fs.mkdir(this.pbjs.outputRoot, buildFn);
    }.bind(this);

    var buildFn = function (err) {
      if (err) return done(err);
      this.pbjs.build(this.root, cleanFn);
    }.bind(this);

    var cleanFn = expectErr(
      new Error('No error when outputRoot existed.'),
      function (err) {
        this.pbjs.clean(checkEmptyFn);
      }.bind(this));

    var checkEmptyFn = function (err) {
      if (err) return done(err);
      this.pbjs._checkEmptyOutput(done);
    }.bind(this);

    mkdirFn();
  });

  var expectedTasks = {
    '.pb_js_test/proto2/test$': 1,
    '.pb_js_test/someprotopackage/package_test$': 1,
  };

  it('builds expected task map', function (done) {
    this.pbjs._buildTaskMap(this.root, function (err, taskMap) {
      if (err) return done(err);
      // console.log(Object.keys(taskMap));
      taskMap.should.matchSet(expectedTasks);
      done(err);
    });
  });

  var expectedFiles = {
    '.pb_js_test/proto2/test.pb.js$': 1,
    '.pb_js_test/someprotopackage/package_test.pb.js$': 1,
  };

  it('writes the expected files', function (done) {
    var old_build = PBJS.Task.prototype.build;
    PBJS.Task.prototype.build = function () {
      return JSON2.stringify(JSON2.decycle(this));
    };
    var restore = function (err) {
      PBJS.Task.prototype.build = old_build;
      done(err);
    };

    return besync.waterfall(restore, [
      this.pbjs.clean,
      funct.injector(this.root),
      this.pbjs.build,
      function (fileList, next) {
        fileList.should.have.length(2);
        fileList.should.matchSet(expectedFiles);

        // console.log(fileList);

        // filter gives no error arg, so have to prepend
        var noErrors = funct.partial(next, null);
        async.filter(fileList, fs.exists, noErrors);
      },
      function (existences, next) {
        // console.log(existences);
        existences.should.matchSet(expectedFiles);
        next();
      },
      this.pbjs.clean,
    ], this.pbjs);
  });

  it('writes what we want', function (done) {
    var _fileListToDataMap = function (fileList, next) {
      var dataMap = {};
      besync.collect(dataMap, fileList, function (file, map, next) {
        fs.readFile(file, function (err, data) {
          if (err) return next(err);
          map[file] = data.toString();
          next();
        });
      }, function (err) {
        next(err, dataMap);
      });
    };

    return besync.waterfall(done, [
      this.pbjs.clean,
      funct.injector(this.root),
      this.pbjs.build,
      _fileListToDataMap,
      function (dataMap, next) {
        // console.log(dataMap);
        dataMap.should.matchSet(expectedFiles);
        next();
      },
      this.pbjs.clean,
    ], this.pbjs);
  });
});
