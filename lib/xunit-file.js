/**
 * Module dependencies.
 */

var mocha = require("mocha")
  , Base = mocha.reporters.Base
  , utils = mocha.utils
  , escape = utils.escape
  , config = require("../config.json")
  , fs = require("fs")
  , filePath = process.env.XUNIT_FILE || config.file || process.cwd() + "/xunit.xml"
  , fd = fs.openSync(filePath, 'w', 0755)
  , consoleOutput = config.consoleOutput || {};

/**
 * Save timer references to avoid Sinon interfering (see GH-237).
 */

var Date = global.Date
  , setTimeout = global.setTimeout
  , setInterval = global.setInterval
  , clearTimeout = global.clearTimeout
  , clearInterval = global.clearInterval;

/**
 * Expose `XUnitFile`.
 */

exports = module.exports = XUnitFile;

/**
 * Initialize a new `XUnitFile` reporter.
 *
 * @param {Runner} runner
 * @api public
 */

function XUnitFile(runner) {
  Base.call(this, runner);
  var stats = this.stats
    , tests = []
    , self = this;
    
  var self = this
    , stats = this.stats
    , indents = 0
    , tests = []
    , n = 0;

  function indent() {
    return Array(indents).join('  ')
  }

  runner.on('start', function(){
    console.log();
  });

  runner.on('suite', function(suite){
    ++indents;
    if(consoleOutput.suite){
      console.log(color('suite', '%s%s'), indent(), suite.title);
    }
  });

  runner.on('suite end', function(suite){
    --indents;
    if (1 == indents) console.log();
  });

  runner.on('test', function(test){
    if(consoleOutput.test){
      process.stdout.write(indent() + color('pass', '  ◦ ' + test.title + ': '));
    }
  });

  runner.on('pending', function(test){
    if(consoleOutput.test){
      var fmt = indent() + color('pending', '  - %s');
      console.log(fmt, test.title);
    }
    
    tests.push(test);
  });

  runner.on('pass', function(test){
    if(consoleOutput.test){
      if ('fast' == test.speed) {
        var fmt = indent()
          + color('checkmark', '  ' + Base.symbols.ok)
          + color('pass', ' %s ');
        cursor.CR();
        console.log(fmt, test.title);
      } else {
        var fmt = indent()
          + color('checkmark', '  ' + Base.symbols.ok)
          + color('pass', ' %s ')
          + color(test.speed, '(%dms)');
        cursor.CR();
        console.log(fmt, test.title, test.duration);
      }
    }
    
    tests.push(test);
  });

  runner.on('fail', function(test, err){
    if(consoleOutput.test){
      cursor.CR();
      console.log(indent() + color('fail', '  %d) %s'), ++n, test.title);
    }
    
    tests.push(test);
  });

  runner.on('end', function() {
    self.epilogue.call(self);
    
    appendLine(tag('testsuite', {
        name: 'Mocha Tests'
      , tests: stats.tests
      , failures: stats.failures
      , errors: stats.failures
      , skipped: stats.tests - stats.failures - stats.passes
      , timestamp: (new Date).toUTCString()
      , time: stats.duration / 1000
    }, false));

    tests.forEach(test);
    appendLine('</testsuite>');
    fs.closeSync(fd);
  });
}

/**
 * Inherit from `Base.prototype`.
 */

XUnitFile.prototype.__proto__ = Base.prototype;

/**
 * Output tag for the given `test.`
 */

function test(test) {
  var attrs = {
      classname: test.parent.fullTitle()
    , name: test.title
    // , time: test.duration / 1000 //old
    ,time: test.duration ? test.duration / 1000 : 0 //new
  };

  if ('failed' == test.state) {
    var err = test.err;
    appendLine(tag('testcase', attrs, false, tag('failure', { message: escape(err.message) }, false, cdata(err.stack))));
  } else if (test.pending) {
    delete attrs.time;
    appendLine(tag('testcase', attrs, false, tag('skipped', {}, true)));
  } else {
    appendLine(tag('testcase', attrs, true) );
  }
}

/**
 * HTML tag helper.
 */

function tag(name, attrs, close, content) {
  var end = close ? '/>' : '>'
    , pairs = []
    , tag;

  for (var key in attrs) {
    pairs.push(key + '="' + escape(attrs[key]) + '"');
  }

  tag = '<' + name + (pairs.length ? ' ' + pairs.join(' ') : '') + end;
  if (content) tag += content + '</' + name + end;
  return tag;
}

/**
 * Return cdata escaped CDATA `str`.
 */

function cdata(str) {
  return '<![CDATA[' + escape(str) + ']]>';
}

function appendLine(line) {
    if (process.env.LOG_XUNIT) {
        console.log(line);
    }
    fs.writeSync(fd, line + "\n", null, 'utf8');
}
