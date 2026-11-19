import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the PRODUCTION build served under a GitHub Pages-style
 * subpath (/candt4cyprus/), so base-path handling is exercised on every run.
 * Locally the installed Chrome is used; CI installs Playwright's Chromium.
 */
const BASE = '/candt4cyprus/';
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:4173${BASE}`,
    trace: 'retain-on-failure',
    ...(process.env.CI ? {} : { channel: 'chrome' }),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...(process.env.CI ? {} : { channel: 'chrome' }) },
    },
  ],
  webServer: {
    command: `npx vite build --base=${BASE} && npx vite preview --base=${BASE} --port 4173 --strictPort`,
    url: `http://localhost:4173${BASE}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
