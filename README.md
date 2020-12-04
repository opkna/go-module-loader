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

**mymath.go**

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

**index.js**

```js
import mymath from './mymath.go';

mymath.add(1, 2).then((sum) => {
    console.log(sum);
});
```
