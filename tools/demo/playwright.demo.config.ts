import { defineConfig, devices } from '@playwright/test';

/**
 * Records captioned demo videos of the production build, for the README GIFs.
 * Not part of the test suite. Run with `npm run demo:gifs`.
 */
const BASE = '/candt4cyprus/';
export const VIEWPORT = { width: 1280, height: 760 };
export default defineConfig({
  testDir: '.',
  testMatch: 'demo.spec.ts',
  outputDir: 'out/test-results',
  timeout: 180_000,
  expect: { timeout: 60_000 },
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    ...(process.env.CI ? {} : { channel: 'chrome' }),
    baseURL: `http://localhost:4174${BASE}`,
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    video: { mode: 'on', size: VIEWPORT },
  },
  webServer: {
    command: `npx vite build --base=${BASE} && npx vite preview --base=${BASE} --port 4174 --strictPort`,
    url: `http://localhost:4174${BASE}`,
    cwd: '../..',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
