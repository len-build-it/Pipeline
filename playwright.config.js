import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    channel: 'msedge',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'off'
  },
  webServer: {
    command: 'node server/demo.js',
    url: 'http://127.0.0.1:3000/api/demo-status',
    reuseExistingServer: false,
    timeout: 15000
  }
});
