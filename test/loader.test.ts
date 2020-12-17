import rewire from 'rewire';
import * as path from 'path';
import * as os from 'os';

const INDEX_PATH = '../lib/loader/index.js';

const FAKE_GOROOT = '/env/go/root';
const FAKE_GOPATH = '/env/go/path';
const FAKE_GOOS = '_js_';
const FAKE_GOARCH = '_wasm_';
const FAKE_GOROOT_EXEC = ' /exec/go/root\n';
const FAKE_GOPATH_EXEC = ' /exec/go/path\n';
const FAKE_WASM_BIN = String.fromCharCode(0, 1, 50, 100, 150, 250, 0);
const FAKE_WASM_EXEC = '(() => {})();';
const FAKE_GOBRIDGE = "const a = '$WASM_FILENAME'";
const FAKE_WASM_FILENAME = 'main.wasm';

describe('Webpack loader function unit tests', () => {
    // Check if the loader compiles and is a function
    test('loader compiles and default export is a function', () => {
        expect.assertions(1);
        const loader = require('../src/loader/index');
        expect(typeof loader.default).toBe('function');
    });

    // goBinPath should return the path to the go binary from the GOROOT path
    test('goBinPath - Should return go path from GOROOT', () => {
        expect.assertions(1);
        const loaderRW = rewire(INDEX_PATH);
        expect(loaderRW.__get__('goBinPath')('/path/to/go')).toBe(
            '/path/to/go/bin/go'
        );
    });

    // getGoEnvs should get GOROOT and GOPATH from process.env, if they don't exist there it should use the command 'go env VAR' instead
    test("getGoEnvs - Get from 'go env VAR'", async (done) => {
        expect.assertions(9);
        let execMock = jest
            .fn()
            .mockReturnValue(Promise.resolve({ stdout: FAKE_GOROOT_EXEC }));
        let execFileMock = jest
            .fn()
            .mockReturnValue(Promise.resolve({ stdout: FAKE_GOPATH_EXEC }));

        const loaderRW = rewire(INDEX_PATH);
        loaderRW.__set__('execAsync', execMock);
        loaderRW.__set__('execFileAsync', execFileMock);

        delete loaderRW.__get__('process').env.GOROOT;
        delete loaderRW.__get__('process').env.GOPATH;
        let res = await loaderRW.__get__('getGoEnvs')();

        expect(res.GOROOT).toBe(FAKE_GOROOT_EXEC.trim());
        expect(execMock.mock.calls.length).toBe(1);
        expect(execMock.mock.calls[0][0]).toBe('go env GOROOT');

        expect(res.GOPATH).toBe(FAKE_GOPATH_EXEC.trim());
        expect(execFileMock.mock.calls.length).toBe(1);
        expect(execFileMock.mock.calls[0][0]).toBe(
            `${FAKE_GOROOT_EXEC.trim()}/bin/go`
        );
        expect(execFileMock.mock.calls[0][1]).toEqual(['env', 'GOPATH']);

        expect(res.GOOS).toBe('js');
        expect(res.GOARCH).toBe('wasm');
        done();
    });

    test("getGoEnvs - Get from 'process.env'", async (done) => {
        expect.assertions(4);
        let execMock = jest.fn();
        let execFileMock = jest.fn();

        const loaderRW = rewire(INDEX_PATH);
        loaderRW.__set__('execAsync', execMock);
        loaderRW.__set__('execFileAsync', execFileMock);

        loaderRW.__get__('process').env.GOROOT = FAKE_GOROOT;
        loaderRW.__get__('process').env.GOPATH = FAKE_GOPATH;
        let res = await loaderRW.__get__('getGoEnvs')();

        expect(res.GOROOT).toBe(FAKE_GOROOT);
        expect(res.GOPATH).toBe(FAKE_GOPATH);
        expect(execMock.mock.calls.length).toBe(0);
        expect(execFileMock.mock.calls.length).toBe(0);
        done();
    });

    test('compileGo - Should build go file and return wasm', async (done) => {
        expect.assertions(10);

        const resourcePath = '/goFilePath.go';
        const tmpDir = os.tmpdir();
        const hash = '0123456789abcdef';
        const goCache = `${tmpDir}/goml-${hash}`;
        const envs = {
            GOROOT: FAKE_GOROOT,
            GOPATH: FAKE_GOROOT,
            GOOS: FAKE_GOOS,
            GOARCH: FAKE_GOARCH,
        };

        const getGoEnvsMock = jest
            .fn()
            .mockReturnValueOnce(Promise.resolve(envs));
        const createHashMock = jest.fn().mockReturnValue(hash);
        const execFileMock = jest.fn().mockReturnValue(Promise.resolve());
        const readFileMock = jest
            .fn()
            .mockReturnValue(Promise.resolve(FAKE_WASM_BIN));
        const rimrafMock = jest
            .fn()
            .mockImplementation((_, resolve: () => void) => {
                resolve();
            });
        const mkdirMock = jest.fn().mockReturnValueOnce(Promise.resolve());

        const loaderRW = rewire(INDEX_PATH);
        loaderRW.__set__('getGoEnvs', getGoEnvsMock);
        loaderRW.__set__('createHash', createHashMock);
        loaderRW.__set__('execFileAsync', execFileMock);
        loaderRW.__set__('readFileAsync', readFileMock);
        loaderRW.__get__('_rimraf').default = rimrafMock;
        loaderRW.__set__('mkdirAsync', mkdirMock);

        const res = await loaderRW.__get__('compileGo')(resourcePath, true);

        expect(getGoEnvsMock.mock.calls.length).toBe(1);

        expect(execFileMock.mock.calls.length).toBe(1);
        expect(execFileMock.mock.calls[0][0]).toBe(`${FAKE_GOROOT}/bin/go`);
        expect(execFileMock.mock.calls[0][1]).toEqual([
            'build',
            '-o',
            `${goCache}/module.wasm`,
            path.basename(resourcePath),
        ]);

        expect(readFileMock.mock.calls.length).toBe(1);
        expect(readFileMock.mock.calls[0][0]).toBe(`${goCache}/module.wasm`);

        expect(res).toBe(FAKE_WASM_BIN);

        expect(rimrafMock.mock.calls.length).toBe(2);
        expect(rimrafMock.mock.calls[0][0]).toBe(goCache);
        expect(rimrafMock.mock.calls[1][0]).toBe(goCache);
        done();
    });

    test('compileGo - Should ignore error when files to delete does not exist', async (done) => {
        expect.assertions(1);
        const loaderRW = rewire(INDEX_PATH);
        loaderRW.__set__('getGoEnvs', () =>
            Promise.resolve({ GOROOT: 'goroot' })
        );
        loaderRW.__set__('execFileAsync', () => Promise.resolve());
        loaderRW.__set__('readFileAsync', () => Promise.resolve(FAKE_WASM_BIN));
        loaderRW.__set__('mkdirAsync', () => Promise.resolve());
        // TODO: Create a better solution if possible
        loaderRW.__get__('_rimraf').default = (_: any, cb: Function) =>
            cb(new Error());

        expect(await loaderRW.__get__('compileGo')('', '')).toBe(FAKE_WASM_BIN);
        done();
    });

    test('getJsModuleCode - Should load gobridge and wasm_exec', async (done) => {
        expect.assertions(5);
        const finalGobridge = FAKE_GOBRIDGE.replace(
            /\$WASM_FILENAME/,
            FAKE_WASM_FILENAME
        );
        const wasmExecPath = path.resolve(
            __dirname,
            '..',
            'lib',
            'browser',
            'wasm_exec.js'
        );
        const goBridgePath = path.resolve(
            __dirname,
            '..',
            'lib',
            'browser',
            'gobridge.js'
        );

        const readFileMock = jest
            .fn()
            .mockReturnValueOnce(Promise.resolve(FAKE_WASM_EXEC))
            .mockReturnValueOnce(Promise.resolve(FAKE_GOBRIDGE));

        const loaderRW = rewire(INDEX_PATH);
        loaderRW.__set__('readFileAsync', readFileMock);

        const res: string = await loaderRW.__get__('getJsModuleCode')(
            FAKE_WASM_FILENAME
        );

        expect(readFileMock.mock.calls.length).toBe(2);
        expect(readFileMock.mock.calls[0][0]).toBe(wasmExecPath);
        expect(readFileMock.mock.calls[1][0]).toBe(goBridgePath);

        expect(res.startsWith(FAKE_WASM_EXEC)).toBe(true);
        expect(res.endsWith(finalGobridge)).toBe(true);

        done();
    });
});
