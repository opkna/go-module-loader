// +build js,wasm

package main

import (
	"github.com/opkna/jsbridge"
)

func main() {
	jsbridge.ExportFunc("bounce", bounce, false)
	jsbridge.ExportFunc("bounceClamped", bounceClamped, true) // Will return []byte to Uint8ClampedArray
	select {}
}

// This will just return the argument, causing wasmbridge to convert the js.Value to go, and back again
func bounce(args []interface{}) (interface{}, error) {
	return args[0], nil
}

// This will just return the argument, causing wasmbridge to convert the js.Value to go, and back again
func bounceClamped(args []interface{}) (interface{}, error) {
	return args[0], nil
}