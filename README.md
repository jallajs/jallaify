<div align="center">

# jallaify 💫

[![npm version](https://img.shields.io/npm/v/jallaify.svg?style=flat-square)](https://npmjs.org/package/jallaify) [![build status](https://img.shields.io/travis/jallajs/jallaify/master.svg?style=flat-square)](https://travis-ci.org/jallajs/jallaify)
[![downloads](http://img.shields.io/npm/dm/jallaify.svg?style=flat-square)](https://npmjs.org/package/jallaify)
[![style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://npmjs.org/package/jallaify)

</div>

Browserify plugin for bundling entire choo applications built with jalla, front-
and back-end, into a single file. Especially usefull with serverless platforms,
e.g. Zeit, AWS etc.

## Usage
If you're just using the jalla CLI you'll have to create a server entry file.
The equivalent of running `jalla index.js` would be to create a file as such:

```javascript
// server.js
var jalla = require('jalla')
var app = jalla('index.js')
module.exports = app.callback()
```

If you already have a server file you will probably need to make some small
changes. Since most serverless platforms expect a single function export,
calling `server.listen()` will not work. E.g. [@now/node][@node/now] expects a
function which takes `req` and `res`. To comply with Now, you would export
`app.callback()` which will return a function accepting `req` and `res`.

```javascript
// server.js
var jalla = require('jalla')
var app = jalla('index.js')

if (process.env.IS_SERVERLESS) module.exports = app.callback()
else app.listen(8080)
```

Provide the server entry file to browserify and define `jallaify` as a plugin.

```bash
$ browserify index.js --node --standalone my-app -p jallaify > build.js
```

Any options provided to jallaify will be forwarded to the compiled jalla app.

```bash
$ browserify index.js --node --standalone my-app -p [ jallaify --sw sw.js ] > build.js
```

*The `standalone` option is required for browserify to actually expose the
application export and not just execute the bundled code.*

The bundled application is intended to run in production mode (not watching for
changes) and serving built assets. Jallaify will make a best effort to infer the
`serve` option but it is good practice to explicitly define it.

```javascript
var jalla = require('jalla')
var app = jalla('index.js', {
  serve: Boolean(process.env.IS_SERVERLESS)
})

if (process.env.IS_SERVERLESS) module.exports = app.callback()
else app.listen(8080)
```

## See Also
- [choojs/choo][choo]
- [jallajs/jalla][jalla]
- [jalla-now][jalla-now]

## License
MIT

[choo]: https://github.com/choojs/choo
[jalla]: https://github.com/jallajs/jalla
[jalla-now]: https://github.com/jallajs/now
[@now/node]: https://zeit.co/docs/v2/deployments/official-builders/node-js-now-node/
