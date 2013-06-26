var CLI = {};

CLI.ENABLED = true;

CLI.log = function() {
    if (module.exports.ENABLED) {
        console.log.apply(console, arguments);
    }
};

var path = require('path');
var fs = require('fs');

var _usage = function () {
    console.error('Usage: ./' + path.basename(__filename) + ' build ' +
        '--input <root> --output <root> [...options]\n' +
        '\t--force:\tremove the output directory beforehand');
}

var ensureDirectorySync = function (given, type, done) {
    try {
        if (!fs.statSync(given).isDirectory()) {
            throw 'bad';
        }
    } catch (err) {
        console.error('\033[31m' + type + ' root ' + given
            + ' did not resolve to a directory.' + '\033[0m');
        process.exit(1);
    }
};

/**
 * @param {Object} options
 * @param {function()} callback
 */
var calcDeps = function(options, callback) {
    var calcdeps = require('calcdeps');
    var closureLib = require('closure-library');
    var entryFile = options.outputRoot + '/deps.js';
    var folders = options.packageFolders;
    var opts = {
        input: folders ? folders : [entryFile],
        path: [closureLib.googJs, options.outputRoot],
        exclude: [],
        dep: [],
        output_mode: 'list'
    };

    calcdeps.calcdeps(opts, function(err, result) {
        if (err) {
          console.error(err);
          process.exit(1);
        } else {
            callback(result);
        }
    });
};

/**
 * @param {Object} options
 * @param {Array.<string>} files
 * @param {function()} callback
 */
var packageSingleFile = function(options, files, callback) {
    var cc = require('closurecompiler');
    var outputWrap;
    var name = options.outputRoot + '/build.min.js';

    var compilationComplete = function(err, result) {
        if (err) {
            console.log(err);
            process.exit(1);
        } else {
            fs.writeFile(name, result, 'utf8', callback);
        }
    };

    var ccOpts = {
        compilation_level: 'ADVANCED_OPTIMIZATIONS',
        generate_exports: true,
        output_wrapper:  "\"function() {%output%}\""
    };

    console.log('[PBJS] Packaging... ' + name);
    cc.compile(files, ccOpts, compilationComplete);
};

/**
 * @param {Object} options
 * @param {function()} callback
 */
var packageResult = function(options, callback) {
    if (!options.packageFolders) {
        return;
    }

    calcDeps(options, function(files) {
        packageSingleFile(options, files, callback);
    });
};

CLI.build = function (argv, done) {
    var options = {
        cleanup: true,
    };
    while (arg = argv.shift()) {
        switch (arg) {
            case '--templates':
                var given = path.resolve(argv.shift());
                ensureDirectorySync(given, 'Template', done);
                options.templateRoot = given;
                continue;
            case '--input':
                options.input = path.resolve(argv.shift());
                ensureDirectorySync(options.input, 'Input', done);
                continue;
            case '--output':
                options.outputRoot = path.resolve(argv.shift());
                continue;
            case '--force':
                options.force = true;
                continue;
            case '--enforcejsdoc':
                var enforcements = argv.shift().replace(/[,;:]/g, '|').split('|');
                options.enforceJsDocs = enforcements;
                continue;
            case '--package_folders':
                var folderPath = path.resolve(argv.shift());
                if (options.packageFolders) {
                    options.packageFolders.push(folderPath);
                } else {
                    options.packageFolders = [folderPath];
                }
                continue;
            default:
                _usage();
                done(1);
        }
    }

    if (!options.outputRoot || !options.input) {
        _usage();
        done(1);
    } else {
        var PBJS = require('..');
        var pbjs = new PBJS(options);

        var resultFn = function(err, taskFileList) {
            packageResult(options, function() {
                if (err) {
                    console.error('\033[31m' + err + '\033[0m');
                    done(1);
                } else {
                    console.log('\033[32mBuild completed okay!\033[0m');
                    done(0);
                }
            });
        };

        var buildFn = pbjs.build.bind(pbjs, options.input, resultFn);
        if (options.force) {
            pbjs.clean(buildFn);
        } else {
            buildFn();
        }
    }
};

module.exports = CLI;
