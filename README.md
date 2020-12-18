# go-module-loader

Webpack loader that turns Go code into JS modules, but with WebAssembly in the background.

## Install

Install witn npm:

```bash
npm install --save-dev go-module-loader
```

or with yarn:

```bash
yarn add -D go-module-loader
```

> Note: `go` also have to be installed. And either have `go` in `PATH`, or have `GOROOT` set.

## Usage (with jsbridge)

**webpack.config.js**

```js
module.exports = {
    // ...
    module: {
        rules: [
            {
                test: /\.go$/,
                use: 'go-module-loader',
            },
        ],
    },
};
```

**src/mymath.go**

```go
package main

import (
    "github.com/opkna/jsbridge"
)


func main() {
    jsbridge.ExportFunc("add", add, false)
    select {}
}

func add(args []interface{}) (interface{}, error) {
    a := args[0].(float64)
    b := args[1].(float64)

    return a + b, nil
}
```

**src/index.js**

```js
import mymath from './mymath.go';

mymath.instantiate().then((inst) => {
    console.log(inst.add(1, 2));
});
```

> To be able to test this loader you need to use a development server, otherwise `CORS` will block the fetch for the `wasm` file. Also the dev server need to be able to handle the `application/wasm` MIME type. **webpack-dev-server** work well on both counts.
