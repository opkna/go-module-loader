import { WasmModule } from '../src/browser/gobridge';
import { Browser, Page } from 'puppeteer';
import 'expect-puppeteer';

declare global {
    interface Window {
        __test_go: WasmModule[];
    }
}

declare type Instance1 = {
    bounce: <T>(arg: T) => T;
    bounceClamped: (array: Uint8ClampedArray) => Uint8ClampedArray;
};

const timeout = 5000;
const pupBrowser = (global as any).__BROWSER__ as Browser;

describe('Testing wasmbridge integration', () => {
    let page: Page;
    beforeAll(async () => {
        page = await pupBrowser.newPage();
        page.on('console', (consoleObj) => console.log(consoleObj.text()));
        await page.goto('http://localhost:4444');
    }, timeout);

    test('Convert simple primitives', async (done) => {
        const res = await page.evaluate(async () => {
            const mod = window.__test_go[0];
            const inst: Instance1 = await mod.instantiate();
            const values = [true, false, 0, 2, 1.3, '', 'text1'];
            const res = [];
            for (let v of values) {
                res.push(inst.bounce(v));
            }
            return {
                original: values,
                converted: res,
            };
        });
        for (let i = 0; i < res.original.length; i++) {
            expect(res.converted[i]).toBe(res.original[i]);
        }
        done();
    });

    test('Convert objects', async (done) => {
        const res = await page.evaluate(async () => {
            const mod = window.__test_go[0];
            const inst: Instance1 = await mod.instantiate();

            const values = [
                [true, 2, 'text2'],
                { prop1: false, prop2: 3, prop3: 'text3' },
            ];
            const res = [];
            for (let v of values) {
                // Will convert to GO and back to JS
                res.push(inst.bounce(v));
            }

            return {
                original: values,
                converted: res,
            };
        });
        for (let i = 0; i < res.original.length; i++) {
            expect(res.converted[i]).toEqual(res.original[i]);
        }
        done();
    });
    test('Convert uint arrays', async (done) => {
        const res = await page.evaluate(async () => {
            const mod = window.__test_go[0];
            const inst: Instance1 = await mod.instantiate();

            const values = [
                new Uint8Array([0, 1, 2, 3, 4]),
                new Uint8ClampedArray([4, 3, 2, 1, 0]),
            ];
            const res = [];
            for (let v of values) {
                res.push(inst.bounce(v));
            }

            return {
                original: values,
                converted: res,
            };
        });
        for (let i = 0; i < res.original.length; i++) {
            expect(res.converted[i]).toEqual(res.original[i]);
        }
        done();
    });

    test('Convert falsy values', async (done) => {
        const res = await page.evaluate(async () => {
            const mod = window.__test_go[0];
            const inst: Instance1 = await mod.instantiate();

            // For strictly equal
            const valuesStrict = [undefined, null, false, 0, -0, '', NaN];
            const expectStrict = [null, null, false, 0, 0, '', NaN];
            const resStrict = [];
            for (let v of valuesStrict) {
                resStrict.push(inst.bounce(v));
            }

            // For loose equal
            const valuesEqual = [{}, []];
            const resEqual = [];
            for (let v of valuesEqual) {
                resEqual.push(inst.bounce(v));
            }

            return {
                expectedStrict: expectStrict,
                convertedStricy: resStrict,
                expectedEqual: valuesEqual,
                convertedEqual: resEqual,
            };
        });
        for (let i = 0; i < res.expectedStrict.length; i++) {
            expect(res.convertedStricy[i]).toBe(res.expectedStrict[i]);
        }
        for (let i = 0; i < res.expectedEqual.length; i++) {
            expect(res.convertedEqual[i]).toEqual(res.expectedEqual[i]);
        }
        done();
    });
});
