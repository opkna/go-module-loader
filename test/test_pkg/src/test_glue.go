package main

import (
	"os"
	"syscall/js"
)

const (
	jsBridgeName = "__jsbridge"
)

func main() {
	if len(os.Args) < 2 {
		panic("Expected two arguments")
	}

	js.Global().Get(jsBridgeName).Get(os.Args[1]).Set("bounce", js.FuncOf(bounce))
	select {}
}

func bounce(this js.Value, args []js.Value) interface{} {
	this.Set("result", args[0])
	return nil
}