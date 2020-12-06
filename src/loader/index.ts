import * as child_process from 'child_process';
import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';
import rimraf from 'rimraf';
import { loader } from 'webpack';

let execAsync = util.promisify(child_process.exec);
let execFileAsync = util.promisify(child_process.execFile);
let readFileAsync = util.promisify(fs.readFile);
let unlinkAsync = util.promisify(fs.unlink);

const goBinPath = (goRoot: string) => `${goRoot}/bin/go`;

async function createBridgeCode(filename: string) {
    return (
        await readFileAsync(
            path.resolve(__dirname, '..', 'browser', 'gobridge.js')
        )
    )
        .toString()
        .replace(/\$WASM_FILENAME/, filename);
}

async function getGoEnvs() {
    let GOROOT = process.env.GOROOT;
    if (!GOROOT) {
        try {
            // Try to get GOROOT with 'go env' command
            const { stdout } = await execAsync('go env GOROOT');
            GOROOT = stdout.trim();
        } catch (err) {
            // Unable to find go binary, panic!
            throw Error(
                `Can't find Go! (GOROOT is not set, and go binary is not in PATH)`
            );
        }
    }

    let GOPATH = process.env.GOPATH;
    if (!GOPATH) {
        // Get GOPATH with 'go env'
        const bin = goBinPath(GOROOT);
        const { stdout } = await execFileAsync(bin, ['env', 'GOPATH']);
        GOPATH = stdout.trim();
    }

    return {
        GOROOT,
        GOPATH,
        GOOS: 'js',
        GOARCH: 'wasm',
    };
}

async function compileGo(goFilePath: string, rootContext: string) {
    const outFilePath = goFilePath.replace(/.go$/, '.wasm');
    const goCachePath = path.resolve(rootContext, '.gocache');

    try {
        // Get all go related env vars
        const goEnvs = await getGoEnvs();

        // Compile to wasm
        const bin = goBinPath(goEnvs.GOROOT);
        const args = ['build', '-o', outFilePath, goFilePath];
        const opts = {
            env: {
                ...goEnvs,
                GOCACHE: goCachePath,
            },
        };
        await execFileAsync(bin, args, opts);

        // Read and return the compiled wasm binary
        return await readFileAsync(outFilePath);
    } finally {
        // Remove compiled binary and GO cache directory. Ignore any error if the files are not there anyway
        unlinkAsync(outFilePath).catch(() => {});
        rimraf(goCachePath, () => {});
    }
}

async function getJsModuleCode(emittedWasmPath: string) {
    // Get the wasm_exec.js glue code that Go provides
    const glueCode = await readFileAsync(
        path.resolve(__dirname, '..', 'browser', 'wasm_exec.js')
    );

    // Create and return resulting code
    const bridgeCode = await createBridgeCode(emittedWasmPath);
    // Combine and return
    return `${glueCode}${bridgeCode}`;
}

export default async function (this: loader.LoaderContext) {
    // Make loader async
    const callback = this.async();
    if (!callback) throw new Error('Could not make loader async');

    try {
        // Compile to wasm
        const wasmFile = await compileGo(this.resourcePath, this.rootContext);

        // Emit file to webpack
        const emittedWasmPath =
            path.basename(this.resourcePath, '.go') + '.wasm';
        this.emitFile(emittedWasmPath, wasmFile, null);

        // Get and return module code
        const moduleCode = await getJsModuleCode(emittedWasmPath);
        callback(null, moduleCode);
        return;
    } catch (err) {
        // Forward error to webpack
        callback(err);
        return;
    }
}
