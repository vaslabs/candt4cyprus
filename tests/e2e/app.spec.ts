import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROUTES = [
  ['', 'Cyprus Social Insurance and automation'],
  ['#/replication', 'Paper replication explorer'],
  ['#/automation', 'Automation simulator'],
  ['#/policies', 'Compare financing instruments'],
  ['#/business', 'Company contribution simulator'],
  ['#/sensitivity', 'Sensitivity and uncertainty'],
  ['#/methodology', 'Methodology and sources'],
  ['#/report', 'Policy report'],
] as const;

async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  return errors;
}

test('overview embeds the policy-maker walkthrough with a working transcript', async ({ page, request }) => {
  await page.goto('./');
  const video = page.getByTestId('walkthrough-video');
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute('preload', 'none');
  for (const [attr, type] of [
    ['poster', 'image/jpeg'],
    ['src', 'video/mp4'],
  ] as const) {
    const url =
      attr === 'poster'
        ? await video.getAttribute('poster')
        : await video.locator('source').getAttribute('src');
    expect(url).toMatch(/^\/candt4cyprus\/media\/policy-walkthrough\./);
    const res = await request.get(url ?? '');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain(type);
  }
  const transcript = page.getByTestId('walkthrough-transcript');
  await expect(transcript).toContainText('Step 1');
  const third = transcript.getByRole('listitem').nth(2);
  await third.getByRole('button').click();
  await expect(third).toHaveAttribute('aria-current', 'true');
});

test('overview loads under the GitHub Pages subpath with observed data and a chart', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: ROUTES[0][1] })).toBeVisible();
  await expect(page.locator('[data-provenance="observed"]').first()).toBeVisible();
  await expect(page.locator('.main-svg').first()).toBeVisible(); // Plotly rendered
  expect(errors).toEqual([]);
});

test('every section is reachable from the navigation and survives a reload (hash routing)', async ({
  page,
}) => {
  for (const [hash, heading] of ROUTES) {
    await page.goto(`./${hash}`);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  await page.goto('./');
  await page.getByRole('link', { name: 'Policy comparison' }).click();
  await expect(page).toHaveURL(/#\/policies$/);
});

test('automation simulator computes in the worker and shows labelled results', async ({ page }) => {
  await page.goto('./#/automation');
  await page.getByTestId('run').click();
  await expect(page.getByTestId('run-status')).toContainText('Done');
  await expect(page.getByTestId('automation-current')).toBeVisible();
  await expect(page.locator('[data-provenance="simulated"]').first()).toBeVisible();
  await expect(page.getByText('Social-security contributions as a share of output')).toBeVisible();
  await expect(page.locator('.main-svg').first()).toBeVisible();
});

test('adoption slider updates the scenario value (keyboard accessible)', async ({ page }) => {
  await page.goto('./#/automation');
  const before = await page.getByTestId('adoption-value').textContent();
  await page.getByRole('slider', { name: 'Autonomous-capital adoption parameter' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('adoption-value')).not.toHaveText(before ?? '');
});

test('policy comparison reports all instruments, F/G flags and separate result tables', async ({ page }) => {
  await page.goto('./#/policies');
  await page.getByRole('button', { name: 'Compare instruments' }).click();
  await expect(page.getByTestId('run-status')).toContainText('Done');
  for (const t of [
    'Revenue and status',
    'Real effects vs no new instrument',
    'Distribution and burden',
    'Efficiency (one indicator among several)',
  ]) {
    await expect(page.getByRole('heading', { name: t })).toBeVisible();
  }
  await expect(page.getByText('Policy G (neutral) raises nothing')).toBeVisible();
  await expect(page.locator('[data-provenance="hypothetical"]').first()).toBeVisible();
});

test('company simulator applies statutory rules to the constructed archetype', async ({ page }) => {
  await page.goto('./#/business');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.getByTestId('firm-accounts')).toBeVisible();
  await expect(page.getByText('Existing statutory contributions by recipient')).toBeVisible();
  await expect(
    page
      .getByText('Where the archetype’s numbers come from')
      .or(page.getByText("Where the archetype's numbers come from")),
  ).toBeVisible();
});

test('a long Monte Carlo run can be cancelled and leaves no stale results', async ({ page }) => {
  await page.goto('./#/sensitivity');
  await page.getByLabel('Draws (1–2000)').fill('2000');
  await page.getByRole('button', { name: 'Run Monte Carlo' }).click();
  await expect(page.getByTestId('run-status')).toContainText('Computing');
  await page.getByTestId('cancel').click();
  await expect(page.getByTestId('run-status')).toContainText('Cancelled');
  await expect(page.locator('.main-svg')).toHaveCount(0);
  // The worker is recreated: a new small run still works.
  await page.getByLabel('Draws (1–2000)').fill('3');
  await page.getByRole('button', { name: 'Run Monte Carlo' }).click();
  await expect(page.getByTestId('run-status')).toContainText('Done', { timeout: 60_000 });
});

test('replication explorer reproduces 17 of 21 benchmarks', async ({ page }) => {
  await page.goto('./#/replication');
  await page.getByRole('button', { name: 'Run replication' }).click();
  await expect(page.getByTestId('run-status')).toContainText('Done', { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: /Benchmarks: 17 of 21 pass/ })).toBeVisible();
});

test('scenario export and import round-trip with validation', async ({ page }) => {
  await page.goto('./');
  const download = page.waitForEvent('download');
  await page.getByTestId('export').click();
  const file = await (await download).path();
  const json = JSON.parse(readFileSync(file, 'utf8'));
  expect(json.schemaVersion).toBe(1);
  json.name = 'Imported test scenario';
  const good = join(tmpdir(), 'good.scenario.json');
  writeFileSync(good, JSON.stringify(json));
  await page.getByTestId('import-file').setInputFiles(good);
  await expect(page.getByTestId('scenario-msg')).toContainText('Imported “Imported test scenario”');
  await expect(page.getByLabel('Scenario name')).toHaveValue('Imported test scenario');
  const bad = join(tmpdir(), 'bad.scenario.json');
  writeFileSync(bad, JSON.stringify({ ...json, adoption: 7 }));
  await page.getByTestId('import-file').setInputFiles(bad);
  await expect(page.getByTestId('scenario-msg')).toContainText('Import failed');
});

test('report can be generated and downloaded as Markdown', async ({ page }) => {
  await page.goto('./#/report');
  await page.getByRole('button', { name: 'Generate report' }).click();
  await expect(page.getByTestId('report-preview')).toContainText('What the simulations indicate', {
    timeout: 60_000,
  });
  const download = page.waitForEvent('download');
  await page.getByTestId('download-md').click();
  expect((await download).suggestedFilename()).toMatch(/report\.md$/);
});

test('theme toggle switches dark mode', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('theme-toggle').click(); // system → light
  await page.getByTestId('theme-toggle').click(); // light → dark
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test.describe('mobile layout', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('no horizontal page overflow on any section; menu opens', async ({ page }) => {
    for (const [hash, heading] of ROUTES) {
      await page.goto(`./${hash}`);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow on ${hash || 'overview'}`).toBeLessThanOrEqual(1);
    }
    await page.getByTestId('menu').click();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  });
});
