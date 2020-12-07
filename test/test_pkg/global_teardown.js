// teardown.js
const rimraf = require('rimraf');
const path = require('path');
const os = require('os');

const DIR = path.join(os.tmpdir(), 'jest_puppeteer_global_setup');
module.exports = async function () {
    //Stop static server
    await new Promise((resolve) => {
        global.__SERVER_GLOBAL__.close(resolve);
    });

    // close the browser instance
    await global.__BROWSER_GLOBAL__.close();

    // clean-up the wsEndpoint file
    rimraf.sync(DIR);
};
