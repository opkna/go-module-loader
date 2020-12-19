import { Browser, Page } from 'puppeteer';
import 'expect-puppeteer';

import testPkg, { TestGlue } from './test_pkg/meta';
import { WasmModule } from '../src/browser/gobridge';

const timeout = 5000;
const pupBrowser = (global as any).__BROWSER__ as Browser;

describe('Testing GO-JS interaction', () => {
    let page: Page;
    beforeAll(async () => {
        page = await pupBrowser.newPage();
        page.on('console', (consoleObj) => console.log(consoleObj.text()));
        await page.goto('http://localhost:4444');
    }, timeout);

    test('Can call function', async (done) => {
        expect.assertions(1);
        const res = await page.evaluate(
            async (globalName: string, idx: number) => {
                const mod = window[globalName][idx] as WasmModule;
                const inst = await mod.instantiate<TestGlue>();
                inst.bounce(null);
                return null;
            },
            testPkg.globalArrayName,
            testPkg.indicies.test_glue
        );

        expect(res).toBeNull();
        done();
    });
});
