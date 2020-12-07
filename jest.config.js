const path = require('path');

const PORT = '4444';

const pkgPath = path.resolve(__dirname, 'test', 'test_pkg');

module.exports = {
    projects: [
        {
            displayName: 'Node JS',
            testEnvironment: 'node',
            testMatch: ['<rootDir>/**/*.test.ts'],
        },
        {
            preset: 'jest-puppeteer',
            globals: {
                PATH: `http://localhost:${PORT}`,
            },
            displayName: 'DOM',
            testMatch: ['<rootDir>/**/*.e2e.ts'],
            globalSetup: path.join(pkgPath, 'global_setup.js'),
            globalTeardown: path.join(pkgPath, 'global_teardown.js'),
            testEnvironment: path.join(pkgPath, 'puppeteer_env.js'),
        },
    ],
};
