declare global {
    interface Window {
        __wasmbridge: {
            [key: string]: {
                [key: string]: Function;
            };
        };
    }

    class Go {
        importObject: {};
        constructor(id: string);
        run: (int: WebAssembly.Instance) => Promise<void>;
    }
}

type WasmRunOutput = {
    result?: any;
    error?: any;
};

interface InstantiateOptions {
    restart?: boolean;
}

const defaultOpts: Required<InstantiateOptions> = {
    restart: true,
};

function generateId() {
    return (1 + Math.random() * 0x1000000).toString(36);
}

export class WasmInstance {
    private _wasmModule: WebAssembly.Module;
    private _ready: boolean = false;
    private _uniqId: string;

    constructor(
        module: WebAssembly.Module,
        options: Required<InstantiateOptions>
    ) {
        this._wasmModule = module;
        this._uniqId = generateId();
        window.__wasmbridge[this._uniqId] = {};
    }

    private async _init() {
        this._ready = false;
        try {
            const go = new Go(this._uniqId);
            const instance = await WebAssembly.instantiate(
                this._wasmModule,
                go.importObject
            );

            setTimeout(async () => {
                try {
                    // Infinit loop, so it restarts on failure
                    // TODO: Implement exit functionality
                    // TODO: Safety check if too many restarts happen in a very short period
                    while (true) {
                        const runPromise = go.run(instance);
                        this._ready = true;
                        await runPromise;
                    }
                } catch (err) {
                    console.error('Wasm instance failed');
                    console.error(err);
                }
            });

            while (!this._ready) {
                await new Promise(requestAnimationFrame);
            }
        } catch (err) {
            console.error('Failed to load wasm');
            console.error(err);
        }
    }
}

export class WasmModule {
    private _filePath: string = '$WASM_FILENAME'; // Will be replaced by the loader
    private _wasmModule?: WebAssembly.Module = undefined;

    constructor() {
        // Fetch and compile the wasm module
        WebAssembly.compileStreaming(fetch(this._filePath))
            .then((module) => {
                this._wasmModule = module;
            })
            .catch((err) => {
                console.error('Failed to fetch and compile wasm module');
                console.error(err);
            });
    }

    private createProxy(inst: WasmInstance) {
        return new Proxy(inst, {
            get: (target, key, receiver) => {
                if (typeof key !== 'string') {
                    // Not a string prop
                    return Reflect.get(target, key, receiver);
                }

                // @ts-ignore
                const uniqId = inst._uniqId;
                const func = window.__wasmbridge[uniqId][key];
                if (typeof func !== 'function') {
                    // wasm function does not exist
                    return Reflect.get(target, key, receiver);
                }

                return (...args: any) => {
                    const output: WasmRunOutput = {};
                    func.apply(output, args);

                    if (output.error) throw output.error;
                    else return output.result;
                };
            },
        });
    }

    async instantiate<T>(options?: InstantiateOptions) {
        const opts = {
            ...defaultOpts,
            ...(options ?? {}),
        } as Required<InstantiateOptions>;

        while (!this._wasmModule) {
            await new Promise(requestAnimationFrame);
        }
        const inst = new WasmInstance(this._wasmModule, opts);
        // @ts-ignore
        await inst._init();

        const proxy = this.createProxy(inst);
        return (proxy as unknown) as T;
    }
}

if (!window.__wasmbridge) {
    window.__wasmbridge = {};
}

export default new WasmModule();
