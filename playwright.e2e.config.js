import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000
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
    command: 'node server/index.js',
    url: 'http://127.0.0.1:3000/',
    reuseExistingServer: false,
    timeout: 20000,
    env: {
      PORT: '3000',
      DATABASE_URL: 'postgres://postgres@127.0.0.1:5433/pipeline_test',
      NODE_ENV: 'test',
    }
  }
});
