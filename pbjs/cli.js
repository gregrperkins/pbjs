var CLI = {};

CLI.ENABLED = true;

CLI.log = function() {
    if (module.exports.ENABLED) {
        console.log.apply(console, arguments);
    }
};


var path = require('path');
var fs = require('fs');

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
                // ensureDirectorySync(options.outputRoot, 'Output', done);
                continue;
            case '--force':
                options.force = true;
                continue;
            case '--enforcejsdoc':
                var enforcements = argv.shift().replace(/[,;:]/g, '|').split('|');
                options.enforceJsDocs = enforcements;
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
        var resultFn = function(err) {
            if (err) {
                console.error('\033[31m' + err + '\033[0m');
                done(1);
            } else {
                console.log('\033[32mBuild completed okay!\033[0m');
                done(0);
            }
        }
        var buildFn = pbjs.build.bind(pbjs, options.input, resultFn);
        if (options.force) {
            pbjs.clean(buildFn);
        } else {
            buildFn();
        }
    }
};

module.exports = CLI;
