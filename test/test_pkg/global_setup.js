const puppeteer = require('puppeteer');
const express = require('express');
const mkdirp = require('mkdirp');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');

const DIR = path.join(os.tmpdir(), 'jest_puppeteer_global_setup');
const WWW = path.resolve(__dirname, 'dist');

process.on('SIGINT', () => {
    server.close();
});

module.exports = async function () {
    // Start a static server
    const app = express();
    app.use(express.static(WWW));

    const server = http.createServer(app);
    await new Promise((resolve) => {
        server.listen(4444, resolve);
    });

    global.__SERVER_GLOBAL__ = server;

    // Start Puppeteer browser
    const browser = await puppeteer.launch();
    // store the browser instance so we can teardown it later
    // this global is only available in the teardown but not in TestEnvironments
    global.__BROWSER_GLOBAL__ = browser;

    // use the file system to expose the wsEndpoint for TestEnvironments
    mkdirp.sync(DIR);
    fs.writeFileSync(path.join(DIR, 'wsEndpoint'), browser.wsEndpoint());
};
