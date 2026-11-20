import { defineConfig, devices } from '@playwright/test';

/**
 * Records the policy-maker walkthrough (16:9) of the production build.
 * 1280×720 CSS pixels at device scale 1.5 gives 1920×1080 frames.
 * Not part of the test suite. Run with `npm run demo:walkthrough`.
 */
const BASE = '/candt4cyprus/';
export default defineConfig({
  testDir: '.',
  testMatch: 'walkthrough.spec.ts',
  outputDir: 'out/test-results',
  timeout: 420_000,
  expect: { timeout: 60_000 },
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    ...(process.env.CI ? {} : { channel: 'chrome' }),
    baseURL: `http://localhost:4174${BASE}`,
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1.5,
    colorScheme: 'light',
    locale: 'en-GB',
  },
  webServer: {
    command: `npx vite build --base=${BASE} && npx vite preview --base=${BASE} --port 4174 --strictPort`,
    url: `http://localhost:4174${BASE}`,
    cwd: '../..',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
