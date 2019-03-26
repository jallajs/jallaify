var convertSourceMap = require('convert-source-map')
var transformAst = require('transform-ast')
var evaluate = require('static-eval')
var babelify = require('babelify')
var through = require('through2')
var acorn = require('acorn')
var path = require('path')
var brfs = require('brfs')

var EXCLUDE = [
  'jalla/lib/style',
  'jalla/lib/assets',
  'jalla/lib/script',
  'jalla/lib/service-worker'
]

module.exports = plugin

function plugin (b, opts) {
  if (!b._options.standalone) {
    b.emit('error', Error('jallaify: standalone option is required'))
  }

  EXCLUDE.forEach(function (file) {
    b.exclude(require.resolve(file))
  })

  b.transform(babelify, {
    plugins: ['dynamic-import-split-require'],
    presets: [
      ['@babel/preset-env', {
        targets: 'maintained node versions'
      }]
    ]
  })
  b.transform(brfs)
  b.transform(createTransform(b, opts))
}

function createTransform (b, opts) {
  return function transform (file) {
    if (/\.json$/.test(file)) return through()

    var source = ''
    var variables = []

    return through(write, end)

    function write (chunk, enc, cb) {
      source += chunk
      cb()
    }

    function end (cb) {
      if (this.listenerCount('dep') === 0) {
        throw new Error('jallaify: requires browserify v16 or up')
      }

      var self = this
      var flags = (opts && opts._flags) || {}
      var basedir = flags.basedir || process.cwd()
      var filename = path.relative(basedir, file)

      if (!source.includes('jalla')) {
        cb(null, source)
        return
      }

      var res
      try {
        res = transformAst(source, { parser: acorn, inputFilename: filename }, walk)
        if (flags.debug) {
          var sm = convertSourceMap.fromObject(res.map).toComment()
          res = res.toString() + '\n' + sm + '\n'
        } else {
          res = res.toString()
        }
      } catch (err) {
        return cb(err)
      }
      this.push(res)
      this.push(null)

      function walk (node) {
        if (requiresJalla(node) && node.parent.type === 'VariableDeclarator') {
          variables.push(node.parent.id.name)
        }

        if (node.type === 'CallExpression' &&
          node.callee.type === 'Identifier' &&
          variables.includes(node.callee.name) &&
          node.arguments.length &&
          node.arguments[0].type === 'Literal') {
          let [first, second] = node.arguments
          let entry = path.resolve(path.dirname(file), first.value)

          // emit identified entry file
          b.emit('jalla.entry', entry)

          let serveEnabled = false
          let resolvedServe = false
          let hasServeOption = false
          if (second && second.type === 'ObjectExpression') {
            for (let i = 0, len = second.properties.length; i < len; i++) {
              let key = second.properties[i].key.name
              let value = second.properties[i].value

              if (key === 'serve') {
                hasServeOption = true
                let type = second.properties[i].value.type
                if (type === 'Literal') {
                  // interpret literal serve option
                  serveEnabled = Boolean(value.value)
                  resolvedServe = true
                } else if (type === 'BinaryExpression') {
                  // try and evaluate the serve option
                  let ast = acorn.parse(value.getSource()).body[0].expression
                  serveEnabled = evaluate(ast)
                  resolvedServe = typeof serveEnabled !== 'undefined'
                }
              }
            }

            if (hasServeOption && resolvedServe && !serveEnabled) {
              self.emit('error', Error('jallaify: serve option should be truthy'))
            }
          }

          let options = opts
          if (second) {
            if (!hasServeOption) options = Object.assign({ serve: true }, options)
            options = `Object.assign(${JSON.stringify(options)}, ${second.getSource()})`
          } else {
            options = JSON.stringify(Object.assign({ serve: true }, options))
          }

          if (second) {
            first.update(`"${entry}"`)
            second.update(options)
          } else {
            node.edit.update(`${node.callee.name}("${entry}", ${options})`)
          }
          self.emit('dep', entry)
        }
      }
    }
  }
}

function requiresJalla (node) {
  return (node.type === 'CallExpression' &&
    node.callee && node.callee.name === 'require' &&
    node.arguments.length === 1 &&
    node.arguments[0].value === 'jalla')
}
