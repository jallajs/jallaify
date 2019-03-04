var fs = require('fs')
var path = require('path')
var test = require('tape')
var through = require('through2')
var concat = require('concat-stream')
var browserify = require('browserify')
var plugin = require('..')

var basedir = path.resolve(__dirname, 'fixtures')

test('bundle', function (t) {
  t.plan(3)
  var entry = path.resolve(__dirname, 'fixtures/entry.js')
  var b = browserify(entry, { node: true, standalone: 'test' })
  b.on('error', t.fail)
  b.plugin(plugin, { foo: 'bar' })
  b.bundle().pipe(concat(function (buf) {
    var res = buf.toString()
    var entry = path.resolve(__dirname, 'fixtures/index.js')
    t.ok(res.includes(`jalla("${entry}"`), 'jalla entry file was resolved')
    t.ok(/jalla\(.+?"foo":\s?"bar"/.test(res), 'options were interpolated')
    t.ok(res.includes('<body>Hello planet!</body>'), 'application entry was included')
  }))
})

test('transform throws on explicit falsy serve', function (t) {
  t.plan(1)
  var stream = withOptions('{ serve: false }')
  var b = browserify(stream, { node: true, standalone: 'test', basedir })
  b.plugin(plugin)
  b.bundle().on('error', (err) => t.pass(err.message))
})

test('transform option: missing', function (t) {
  t.plan(1)
  var entry = path.resolve(__dirname, 'fixtures/entry.js')
  var b = browserify(entry, { node: true, standalone: 'test' })
  b.on('error', t.fail)
  b.plugin(plugin)
  b.bundle().pipe(concat(function (buf) {
    var res = buf.toString()
    t.ok(/jalla\(.+?, {"serve":true}\)/.test(res), 'options are added')
  }))
})

test('transform option: static', function (t) {
  t.plan(1)
  var stream = withOptions('OPTIONS')
  var b = browserify(stream, { node: true, standalone: 'test', basedir })
  b.on('error', t.fail)
  b.plugin(plugin)
  b.bundle().pipe(concat(function (buf) {
    var res = buf.toString()
    t.ok(res.includes('Object.assign({"serve":true}, OPTIONS)'), 'default serve option added')
  }))
})

test('transform option: dynamic', function (t) {
  t.plan(1)
  var stream = withOptions('GET_OPTIONS()')
  var b = browserify(stream, { node: true, standalone: 'test', basedir })
  b.on('error', t.fail)
  b.plugin(plugin)
  b.bundle().pipe(concat(function (buf) {
    var res = buf.toString()
    t.ok(res.includes('Object.assign({"serve":true}, GET_OPTIONS())'), 'default serve option added')
  }))
})

test('transform option: unresolvable expression', function (t) {
  t.plan(1)
  var stream = withOptions('{ serve: FOO === "bar" }')
  var b = browserify(stream, { node: true, standalone: 'test', basedir })
  b.on('error', t.fail)
  b.plugin(plugin)
  b.bundle().pipe(concat(function (buf) {
    var res = buf.toString()
    t.ok(res.includes('FOO === "bar"'), 'options are preserved')
  }))
})

test('transform option: resolvable expression', function (t) {
  t.plan(1)
  var stream = withOptions('{ serve: 1 + 1 === 2 }')
  var b = browserify(stream, { node: true, standalone: 'test', basedir })
  b.on('error', t.fail)
  b.plugin(plugin)
  b.bundle().pipe(concat(function (buf) {
    var res = buf.toString()
    t.ok(res.includes('1 + 1 === 2'), 'options are preserved')
  }))
})

// create stream of entry file with injected options
// str -> stream
function withOptions (opts) {
  var source = ''
  var entry = path.resolve(__dirname, 'fixtures/entry.js')
  var stream = through(write, end)
  fs.createReadStream(entry).pipe(stream)
  return stream

  function write (chunk, enc, cb) {
    source += chunk
    cb()
  }

  function end () {
    this.push(source.replace(/jalla\('index\.js'\)/, `jalla('index.js', ${opts})`))
    this.push(null)
  }
}
