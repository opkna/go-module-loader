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

## Usage (with wasmbridge)

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
	"github.com/opkna/wasmbridge"
)


func main() {
	wasmbridge.ExportFunc("add", add)
	select {}
}

func add(args []interface{}) (interface{}, error) {
	a := args[0].(int)
    b := args[1].(int)

	return a + b, nil
}
```

**src/index.js**

```js
import mymath from './mymath.go';

mymath.add(1, 2).then((sum) => {
    console.log(sum);
});
```

> To be able to test this loader you need to use a development server, otherwise `CORS` will block the fetch for the `wasm` file. Also the dev server need to be able to handle the `application/wasm` MIME type. **webpack-dev-server** work well on both counts.