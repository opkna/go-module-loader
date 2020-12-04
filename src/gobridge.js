let generateId = () => {
    return Math.floor((1 + Math.random()) * 0x1000000).toString(16);
};

const wasmInst = {
    _inst: undefined,
    _ready: false,
    _uniqName: undefined,

    _init: async () => {
        wasmInst._uniqName = `__gobridge${generateId()}`;
        window[wasmInst._uniqName] = {};

        try {
            const go = new Go(wasmInst._uniqName);
            const wasmMod = await WebAssembly.instantiateStreaming(
                fetch('$WASM_FILENAME'),
                go.importObject
            );
            go.run(wasmMod.instance);
            wasmInst._ready = true;
        } catch (err) {
            console.error('Failed to load wasm');
            console.error(err);
        }
    },
    _waitForReady: async () => {
        while (!wasmInst._ready) {
            await new Promise(requestAnimationFrame);
        }
    },
};
const proxy = new Proxy(wasmInst, {
    get: (target, key) => {
        if (key.startsWith('_')) return target[key];
        return (...args) =>
            new Promise((resolve, reject) => {
                target._waitForReady().then(() => {
                    const output = {};
                    window[target._uniqName][key].apply(output, args);
                    if (output.error) reject(output.error);
                    else resolve(output.result);
                });
            });
    },
});

proxy._init();
export default proxy;
