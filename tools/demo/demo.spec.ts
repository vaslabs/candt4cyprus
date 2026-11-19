/**
 * Captioned walkthroughs of each capability, recorded as video and converted to GIFs
 * for the README (see makeGifs.sh). A caption bar and a visible cursor are injected
 * into the page; nothing in the app itself is changed.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, 'out');
mkdirSync(OUT, { recursive: true });

const OVERLAY = `
(() => {
  const install = () => {
    if (document.getElementById('demo-caption')) return;
    const style = document.createElement('style');
    style.textContent = \`
      #demo-caption{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:99999;
        max-width:min(980px,92vw);padding:12px 20px;border-radius:12px;background:rgba(15,23,42,.92);
        color:#f8fafc;font:600 19px/1.35 system-ui,sans-serif;text-align:center;
        box-shadow:0 8px 30px rgba(0,0,0,.35);transition:opacity .25s;pointer-events:none}
      #demo-caption:empty{opacity:0}
      #demo-cursor{position:fixed;z-index:100000;width:20px;height:20px;margin:-10px 0 0 -10px;
        border-radius:50%;background:rgba(13,148,136,.35);border:2px solid #0f766e;pointer-events:none;
        transition:transform .12s}
      #demo-cursor.down{transform:scale(.7);background:rgba(13,148,136,.7)}\`;
    document.head.appendChild(style);
    const cap = document.createElement('div');
    cap.id = 'demo-caption';
    const cur = document.createElement('div');
    cur.id = 'demo-cursor';
    cur.style.left = '-40px';
    document.body.append(cap, cur);
    addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => cur.classList.add('down'), true);
    addEventListener('mouseup', () => cur.classList.remove('down'), true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', install); else install();
})();`;

class Demo {
  private readonly t0 = Date.now();
  private start = 0;
  constructor(
    readonly page: Page,
    readonly name: string,
  ) {}

  /** Marks the moment the page is ready; everything before is trimmed from the GIF. */
  ready() {
    this.start = (Date.now() - this.t0) / 1000;
  }

  async caption(text: string, holdMs = 2600) {
    await this.page.evaluate((t) => {
      const el = document.getElementById('demo-caption');
      if (el) el.textContent = t;
    }, text);
    await this.page.waitForTimeout(holdMs);
  }

  async moveTo(target: Locator) {
    await target.scrollIntoViewIfNeeded();
    const b = await target.boundingBox();
    if (!b) return;
    await this.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 });
    await this.page.waitForTimeout(250);
  }

  async click(target: Locator) {
    await this.moveTo(target);
    await target.click();
    await this.page.waitForTimeout(400);
  }

  /** Smoothly scrolls so the target sits near the top of the viewport. */
  async scrollTo(target: Locator, offset = 90) {
    const y = await target.evaluate((el, off) => el.getBoundingClientRect().top + scrollY - off, offset);
    await this.page.evaluate((top) => scrollTo({ top, behavior: 'smooth' }), y);
    await this.page.waitForTimeout(1100);
  }

  async finish() {
    await this.caption('', 300);
    const video = this.page.video();
    const end = (Date.now() - this.t0) / 1000;
    await this.page.close();
    await video?.saveAs(join(OUT, `${this.name}.webm`));
    writeFileSync(join(OUT, `${this.name}.json`), JSON.stringify({ start: this.start, end }));
  }
}

async function open(page: Page, name: string, hash: string, heading: string) {
  await page.addInitScript(OVERLAY);
  const d = new Demo(page, name);
  await page.goto(`./${hash}`);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  await page.waitForTimeout(600);
  d.ready();
  return d;
}

const done = (page: Page) => expect(page.getByTestId('run-status')).toContainText('Done');

test('01-overview', async ({ page }) => {
  const d = await open(page, '01-overview', '', 'Cyprus Social Insurance and automation');
  await d.caption('Cyprus overview: official statistics and the Social Insurance Fund accounts, 2015–2025');
  await d.moveTo(page.locator('[data-provenance="observed"]').first());
  await d.caption('Every number carries a provenance label: observed, derived, calibrated, assumed…');
  await d.scrollTo(page.getByRole('heading', { name: 'Social Insurance Fund receipts and expenditure' }));
  await d.moveTo(page.locator('.main-svg').first());
  await page.mouse.move(820, 430, { steps: 20 });
  await d.caption('Fund receipts by source vs expenditure, extracted from official SIS bulletins');
  await d.moveTo(page.getByText('Maximum insurable earnings, monthly-paid employees'));
  await d.caption('2026 statutory rules, each linked to its legal or official source');
  await d.scrollTo(page.getByText('What the model can and cannot say'), 300);
  await d.caption('Limits and data gaps are stated up front. Results are simulations, not forecasts');
  await d.finish();
});

test('02-automation', async ({ page }) => {
  const d = await open(page, '02-automation', '#/automation', 'Automation simulator');
  await d.caption('Automation simulator: how rising AI and robot adoption changes the economy');
  const slider = page.getByRole('slider', { name: 'Autonomous-capital adoption parameter' });
  await d.moveTo(slider);
  await slider.focus();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(90);
  }
  await d.caption('Set adoption and elasticities. Assumptions are labelled, with units and ranges', 2000);
  await d.click(page.getByTestId('run'));
  await done(page);
  await d.caption('The model is solved in a Web Worker in your browser. Nothing is sent to a server');
  await d.scrollTo(page.getByText('Social-security contributions as a share of output'));
  await page.mouse.move(700, 420, { steps: 20 });
  await d.caption('Without new taxes, SS contributions fall below the Fund target as adoption rises');
  await d.scrollTo(page.getByText('Gross and net labour income shares'));
  await d.caption("Labour's share of income falls; every chart states units, baseline, source and caveats");
  await d.finish();
});

test('03-policies', async ({ page }) => {
  const d = await open(page, '03-policies', '#/policies', 'Compare financing instruments');
  await d.caption('Policy comparison: the paper’s robot taxes vs four exploratory instruments');
  await d.click(page.getByRole('button', { name: 'Compare instruments' }));
  await done(page);
  await d.scrollTo(page.getByRole('heading', { name: 'Revenue and status' }));
  await d.caption('Each instrument’s required rate is solved to restore the same financing target');
  await d.moveTo(page.getByText('unattainable').first());
  await d.caption('Failures are flagged, not hidden: neutral G raises nothing without economic rents');
  await d.scrollTo(page.getByRole('heading', { name: 'Real effects vs no new instrument' }));
  await d.caption('Effects on GDP, investment and working time…', 2000);
  await d.scrollTo(page.getByRole('heading', { name: 'Distribution and burden' }));
  await d.caption('…distribution and efficiency are reported separately. No single “winner” score');
  await d.finish();
});

test('04-company', async ({ page }) => {
  const d = await open(page, '04-company', '#/business', 'Company contribution simulator');
  await d.caption('Company simulator: exact 2026 payroll rules applied to a constructed firm');
  await d.click(page.getByRole('combobox', { name: 'Archetype' }));
  await d.click(page.getByRole('option', { name: /Software & IT/ }));
  await d.caption('Archetypes are built from Eurostat business statistics. Every field is editable', 2000);
  await d.click(page.getByRole('button', { name: 'Calculate' }));
  await expect(page.getByTestId('firm-accounts')).toBeVisible();
  await d.scrollTo(page.getByRole('heading', { name: 'Company accounts' }));
  await d.caption('Value added, labour share and margins, derived from the sector statistics', 2200);
  await d.scrollTo(page.getByRole('heading', { name: 'Existing statutory contributions by recipient' }));
  await d.caption(
    'Statutory contributions by recipient, with the SI ceiling applied per employee and period',
  );
  await d.scrollTo(page.getByRole('heading', { name: /Existing employer contributions vs exploratory/ }));
  await d.caption('Compared with the exploratory contributions E, F and G, with reasons for each');
  await d.scrollTo(page.getByRole('heading', { name: /numbers come from/ }));
  await d.caption('Provenance of every input: observed, derived from SBS, assumed or behavioural');
  await d.finish();
});

test('05-sensitivity', async ({ page }) => {
  const d = await open(page, '05-sensitivity', '#/sensitivity', 'Sensitivity and uncertainty');
  await d.caption('Sensitivity and uncertainty: how much do the conclusions depend on assumptions?');
  const draws = page.getByLabel('Draws (1–2000)');
  await d.moveTo(draws);
  await draws.fill('150');
  await d.click(page.getByRole('button', { name: 'Run Monte Carlo' }));
  await done(page);
  await d.scrollTo(page.locator('.main-svg').first(), 200);
  await d.caption('Monte Carlo bands over uncertain parameters. Long runs can be cancelled at any time');
  await d.scrollTo(page.getByRole('tab', { name: 'Policy E and capital mobility' }));
  await d.click(page.getByRole('tab', { name: 'Policy E and capital mobility' }));
  await d.click(page.getByRole('button', { name: 'Run sensitivity analysis' }));
  await expect(page.getByRole('heading', { name: 'Long run vs short run with capital fixed' })).toBeVisible();
  await d.scrollTo(page.getByRole('heading', { name: 'Long run vs short run with capital fixed' }));
  await d.caption('Rankings can flip: E is cheapest in the long run, but most costly when capital is fixed');
  await d.finish();
});

test('06-replication', async ({ page }) => {
  const d = await open(page, '06-replication', '#/replication', 'Paper replication explorer');
  await d.caption('Replication explorer: reproduces Casas & Torres (2026) from the published equations');
  await d.click(page.getByRole('button', { name: 'Run replication' }));
  await done(page);
  await d.moveTo(page.getByRole('heading', { name: /Benchmarks: 17 of 21 pass/ }));
  await d.caption('17 of 21 published benchmarks reproduced. The 4 discrepancies are documented, not tuned');
  await d.scrollTo(page.getByText('SS contributions / output without robot taxes (paper Fig. 1)'));
  await page.mouse.move(760, 400, { steps: 20 });
  await d.caption('The paper’s figures recomputed live, with each equation variant selectable');
  await d.finish();
});

test('07-methodology', async ({ page }) => {
  const d = await open(page, '07-methodology', '#/methodology', 'Methodology and sources');
  await d.caption('Methodology and sources: the model, its deviations and every data source');
  await d.click(page.getByRole('tab', { name: /Deviations/ }));
  await d.caption('Every departure from the printed paper is recorded and shown in outputs', 2200);
  await d.click(page.getByRole('tab', { name: /Parameters/ }));
  const q = page.getByLabel('Search parameters');
  await d.moveTo(q);
  await q.pressSequentially('ceiling', { delay: 90 });
  await d.caption('Search all Cyprus parameters, with value, units, status and source');
  await d.click(page.getByRole('tab', { name: /Sources/ }));
  await d.caption('Official sources with URLs, retrieval dates and file hashes');
  await d.finish();
});

test('08-scenarios-report', async ({ page }) => {
  const d = await open(page, '08-scenarios-report', '#/report', 'Policy report');
  await d.caption('Scenarios and reports: name, save, duplicate, export and import your scenarios');
  const name = page.getByLabel('Scenario name');
  await d.moveTo(name);
  await name.fill('');
  await name.pressSequentially('High adoption, Tech B', { delay: 60 });
  await d.click(page.getByRole('button', { name: 'Save scenario' }));
  await d.caption('Saved only in this browser. No accounts, cookies or analytics', 2000);
  await d.click(page.getByRole('button', { name: 'Generate report' }));
  await expect(page.getByTestId('report-preview')).toContainText('What the simulations indicate');
  await d.scrollTo(page.getByTestId('report-preview'), 140);
  await d.caption('An evidence-based report generated in the browser: Markdown, HTML or PDF');
  await d.click(page.getByTestId('theme-toggle'));
  await d.click(page.getByTestId('theme-toggle'));
  await d.caption('Light and dark themes, keyboard accessible, and works on mobile');
  await d.finish();
});
