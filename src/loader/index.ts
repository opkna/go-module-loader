import * as child_process from 'child_process';
import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import rimraf from 'rimraf';
import { loader } from 'webpack';

let execAsync = util.promisify(child_process.exec);
let execFileAsync = util.promisify(child_process.execFile);
let readFileAsync = util.promisify(fs.readFile);
let mkdirAsync = util.promisify(fs.mkdir);

function goBinPath(goRoot: string) {
    return path.resolve(goRoot, 'bin', 'go');
}
function createCachePath(hash: string) {
    return path.resolve(os.tmpdir(), `goml-${hash}`);
}
function createHash(seed: string) {
    return crypto.createHash('md5').update(seed).digest('hex');
}

/**
 * Finds and returns needed GO environment variables
 */
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

/**
 * Will compile a GO file or module and return the wasm binary
 *
 * @param goFilePath Path to `.go` or `.mod` file.
 * @param clearCache If true, will clear cache before and after compilation
 */
async function compileGo(goFilePath: string, clearCache: boolean) {
    // Create hash from file path
    const hash = createHash(goFilePath);

    // Use hash to create tmp folder, so the same resource get's the same cache folder every compile
    const goCachePath = createCachePath(hash);

    try {
        // Folder where GO source is located
        const srcDir = path.dirname(goFilePath);

        // Get filename of GO source
        const inputFile = path.basename(goFilePath);

        if (clearCache) {
            // Removes cache if it exist, ignore error if does not exist
            await new Promise((resolve) => {
                rimraf(goCachePath, resolve);
            });
        }

        // Create cache directory
        await mkdirAsync(goCachePath, { recursive: true });

        // Get all go related env vars
        const goEnvs = await getGoEnvs();

        // Compile to wasm
        const outFilePath = path.resolve(goCachePath, 'module.wasm');
        const bin = goBinPath(goEnvs.GOROOT);
        const args = ['build', '-o', outFilePath, inputFile];
        const opts: child_process.ExecFileOptions = {
            cwd: srcDir,
            env: {
                ...goEnvs,
                GOCACHE: goCachePath,
            },
        };
        await execFileAsync(bin, args, opts);

        // Read and return the compiled wasm binary
        return await readFileAsync(outFilePath);
    } finally {
        if (clearCache) {
            // Remove compiled binary and GO cache directory. Ignore any error if the files are not there anyway
            rimraf(goCachePath, () => {});
        }
    }
}

async function getJsModuleCode(emittedWasmPath: string) {
    // Get the wasm_exec.js glue code that Go provides
    const glueCode = await readFileAsync(
        path.resolve(__dirname, '..', 'browser', 'wasm_exec.js')
    );

    // Get bridge code and set set the emittedWasmPath as the file to fetch
    const bridgeCode = (
        await readFileAsync(
            path.resolve(__dirname, '..', 'browser', 'gobridge.js')
        )
    )
        .toString()
        .replace(/\$WASM_FILENAME/, emittedWasmPath);

    // Combine and return
    return `${glueCode}${bridgeCode}`;
}

export default async function (this: loader.LoaderContext) {
    // Make loader async
    const callback = this.async();
    if (!callback) throw new Error('Could not make loader async');

    try {
        // Compile to wasm
        const wasmFile = await compileGo(this.resourcePath, true);

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
