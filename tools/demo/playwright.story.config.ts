import { defineConfig, devices } from '@playwright/test';

/**
 * Records the vertical (9:16) Instagram story video of the production build.
 * 540×960 CSS pixels at device scale 2 gives 1080×1920 frames.
 * Not part of the test suite. Run with `npm run demo:story`.
 */
const BASE = '/candt4cyprus/';
export default defineConfig({
  testDir: '.',
  testMatch: 'story.spec.ts',
  outputDir: 'out/test-results',
  timeout: 240_000,
  expect: { timeout: 60_000 },
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    ...(process.env.CI ? {} : { channel: 'chrome' }),
    baseURL: `http://localhost:4174${BASE}`,
    viewport: { width: 540, height: 960 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    locale: 'el-GR',
  },
  webServer: {
    command: `npx vite build --base=${BASE} && npx vite preview --base=${BASE} --port 4174 --strictPort`,
    url: `http://localhost:4174${BASE}`,
    cwd: '../..',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
