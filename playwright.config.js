const { defineConfig } = require('@playwright/test');
const fs = require('fs');

// Use pre-installed browser if the default revision isn't available
const CHROME_1194 = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = fs.existsSync(CHROME_1194) ? CHROME_1194
  : process.env.PW_CHROMIUM && fs.existsSync(process.env.PW_CHROMIUM) ? process.env.PW_CHROMIUM : undefined;

module.exports = defineConfig({
  testDir: './tests',
  testIgnore: '**/node/**',        // plain Node unit tests: npm run test:unit
  timeout: 30000,
  use: {
    headless: true,
    baseURL: 'http://localhost:8080',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: 'node tests/server.js',
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});
