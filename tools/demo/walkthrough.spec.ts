/**
 * Policy-maker walkthrough (1920×1080 MP4, English captions), recorded from the production build.
 * The video is committed under public/media and embedded in the app's overview page.
 *
 * Every number in a caption is read from the page at recording time, so captions always show
 * what the app computed. Captions and cards are injected overlays; the app itself is unchanged.
 * A transcript with timestamps is written alongside the frames (transcript.json).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Recorder } from './recorder';

const OUT = join(import.meta.dirname, 'out', 'walkthrough');

const OVERLAY = `
(() => {
  const install = () => {
    if (document.getElementById('wt-caption')) return;
    const style = document.createElement('style');
    style.textContent = \`
      #wt-caption{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:99999;
        width:min(1100px,calc(100% - 48px));padding:14px 22px;border-radius:14px;
        background:rgba(15,23,42,.94);color:#f8fafc;font:600 21px/1.4 Inter,system-ui,sans-serif;
        box-shadow:0 10px 34px rgba(0,0,0,.35);transition:opacity .35s;pointer-events:none}
      #wt-caption.hide{opacity:0}
      #wt-caption .step{display:block;margin-bottom:4px;color:#5eead4;
        font:800 14px/1.2 Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}
      #wt-card{position:fixed;inset:0;z-index:100001;display:flex;flex-direction:column;justify-content:center;
        gap:26px;padding:0 150px;color:#f8fafc;
        background:radial-gradient(120% 90% at 15% 10%,#115e59 0%,#0f172a 55%,#020617 100%);
        font:600 28px/1.35 Inter,system-ui,sans-serif;transition:opacity .45s;pointer-events:none}
      #wt-card.hide{opacity:0}
      #wt-card .big{font:800 42px/1.2 Inter,system-ui,sans-serif;letter-spacing:-.01em;max-width:1000px}
      #wt-card .accent{color:#5eead4}
      #wt-card .small{font:500 21px/1.4 Inter,system-ui,sans-serif;color:#cbd5e1}
      #wt-card .tag{font:700 17px/1 Inter,system-ui,sans-serif;color:#5eead4;letter-spacing:.1em}
      #wt-card ol{margin:0;padding:0;list-style:none;display:grid;gap:16px;counter-reset:s;
        font:600 27px/1.3 Inter,system-ui,sans-serif}
      #wt-card li{counter-increment:s;display:flex;gap:16px;align-items:baseline;opacity:0;
        transform:translateY(10px);animation:wt-in .45s forwards}
      #wt-card li::before{content:counter(s);color:#5eead4;font-weight:800;min-width:1.2em}
      @keyframes wt-in{to{opacity:1;transform:none}}
      #wt-cursor{position:fixed;z-index:100000;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;
        background:rgba(13,148,136,.35);border:3px solid #0f766e;pointer-events:none;transition:transform .12s}
      #wt-cursor.down{transform:scale(.7);background:rgba(13,148,136,.75)}\`;
    document.head.appendChild(style);
    const cap = document.createElement('div'); cap.id = 'wt-caption'; cap.className = 'hide';
    const card = document.createElement('div'); card.id = 'wt-card'; card.className = 'hide';
    const cur = document.createElement('div'); cur.id = 'wt-cursor'; cur.style.left = '-60px';
    document.body.append(cap, card, cur);
    addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => cur.classList.add('down'), true);
    addEventListener('mouseup', () => cur.classList.remove('down'), true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', install); else install();
})();`;

export interface TranscriptEntry {
  /** Position in the video, seconds. */
  t: number;
  step?: string;
  text: string;
}

/** Reading time for a caption: about 15 characters per second, at least 2.6 s. */
const readMs = (text: string) => Math.max(2600, 800 + text.length * 62);

class Walkthrough {
  readonly transcript: TranscriptEntry[] = [];
  rec: Recorder | null = null;
  constructor(readonly page: Page) {}

  private log(text: string, step?: string) {
    const t = Math.round((this.rec?.elapsed() ?? 0) * 10) / 10;
    this.transcript.push(step ? { t, step, text } : { t, text });
  }

  async caption(step: string | undefined, text: string, holdMs = readMs(text)) {
    this.log(text, step);
    await this.page.evaluate(
      ([s, t]) => {
        const el = document.getElementById('wt-caption');
        if (!el) return;
        el.replaceChildren();
        if (s) {
          const tag = document.createElement('span');
          tag.className = 'step';
          tag.textContent = s;
          el.append(tag);
        }
        el.append(document.createTextNode(t ?? ''));
        el.classList.remove('hide');
      },
      [step, text] as const,
    );
    await this.page.waitForTimeout(holdMs);
  }

  async hideCaption() {
    await this.page.evaluate(() => document.getElementById('wt-caption')?.classList.add('hide'));
    await this.page.waitForTimeout(300);
  }

  /** Full-screen card. `text` is its plain-text version for the transcript. */
  async card(html: string, text: string, holdMs: number) {
    if (text) this.log(text);
    await this.page.evaluate((h) => {
      const el = document.getElementById('wt-card');
      if (!el) return;
      el.innerHTML = h;
      el.classList.remove('hide');
    }, html);
    await this.page.waitForTimeout(holdMs);
  }

  async hideCard() {
    await this.page.evaluate(() => document.getElementById('wt-card')?.classList.add('hide'));
    await this.page.waitForTimeout(500);
  }

  /** Navigates with the sidebar, as a user would, so the scenario carries over. */
  async nav(link: string, heading: string) {
    await this.hideCaption();
    await this.click(this.page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: link }));
    await expect(this.page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await this.page.evaluate(() => scrollTo({ top: 0 }));
    await this.page.waitForTimeout(500);
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
    await this.page.waitForTimeout(350);
  }

  async scrollTo(target: Locator, offset = 90) {
    const y = await target.evaluate((el, off) => el.getBoundingClientRect().top + scrollY - off, offset);
    await this.page.evaluate((top) => scrollTo({ top, behavior: 'smooth' }), y);
    await this.page.waitForTimeout(1100);
  }

  /** Moves the adoption slider with the keyboard, one 0.01 step at a time, to `value`. */
  async setAdoption(value: number) {
    const slider = this.page.getByRole('slider', { name: 'Autonomous-capital adoption parameter' });
    await this.moveTo(slider);
    await slider.focus();
    for (let i = 0; i < 60; i++) {
      const now = Number(await slider.getAttribute('aria-valuenow'));
      if (Math.abs(now - value) < 0.005) break;
      await this.page.keyboard.press(now < value ? 'ArrowRight' : 'ArrowLeft');
      await this.page.waitForTimeout(45);
    }
    await expect(slider).toHaveAttribute('aria-valuenow', String(value));
    await this.page.waitForTimeout(400);
  }
}

const done = (page: Page) => expect(page.getByTestId('run-status')).toContainText('Done');

/** "0.0720" → "7.2%". */
const asPct = (s: string) => `${(Number(s) * 100).toFixed(1)}%`;

/** Value of a statistic in the automation summary card. */
const stat = (page: Page, label: string) =>
  page.getByTestId('automation-current').locator(`dt:text-is("${label}") + dd`).innerText();

/** Required rate of an instrument from the comparison table, or its status if not solved. */
async function rate(page: Page, code: string) {
  const row = page
    .getByRole('table', { name: 'Revenue and status by instrument' })
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: code, exact: true }) });
  const cells = row.getByRole('cell');
  const status = (await cells.nth(2).innerText()).trim();
  return status === 'solved' ? asPct(await cells.nth(3).innerText()) : status;
}

/** Long-run GDP change of an instrument from the real-effects table. */
async function gdp(page: Page, code: string) {
  const row = page
    .getByRole('table', { name: 'Real effects' })
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: code, exact: true }) });
  return (await row.getByRole('cell').nth(1).innerText()).trim();
}

/** Target SS/output, from the comparison subtitle ("… Target SS/Y 6.45% of output"). */
async function target(page: Page) {
  const t = await page.getByText(/Target SS\/Y [\d.]+% of output/).innerText();
  return /Target SS\/Y ([\d.]+%)/.exec(t)?.[1] ?? '?';
}

test('policy-walkthrough', async ({ page }) => {
  await page.addInitScript(OVERLAY);
  const w = new Walkthrough(page);
  await page.goto('./');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Cyprus Social Insurance and automation' }),
  ).toBeVisible();
  // The opening card is in place before the first frame is captured.
  await page.evaluate(() => {
    const el = document.getElementById('wt-card');
    if (el) el.style.transition = 'none';
  });
  await w.card('', '', 0);
  await page.evaluate(() => {
    const el = document.getElementById('wt-card');
    if (el) el.style.transition = '';
  });
  const rec = new Recorder(page, OUT, { width: 1920, height: 1080 });
  w.rec = rec;
  await rec.start();
  await page.waitForTimeout(300);

  // Opening: the question, and the method
  await w.card(
    `<p class="tag">A WALKTHROUGH FOR POLICY MAKERS</p>
     <p class="big">If automation erodes payroll contributions, what would it take to keep Cyprus’s
       <span class="accent">Social Insurance Fund</span> financed, and at what cost?</p>
     <p class="small">Cyprus AI, Automation and Social Insurance simulator</p>`,
    'If automation erodes payroll contributions, what would it take to keep Cyprus’s Social Insurance Fund financed, and at what cost?',
    5200,
  );
  await w.card(
    `<p class="tag">THE METHOD</p>
     <ol>
       <li style="animation-delay:.2s">Assume how far automation goes</li>
       <li style="animation-delay:.7s">See the financing gap it opens</li>
       <li style="animation-delay:1.2s">Compare the instruments that could close it, and their rates</li>
       <li style="animation-delay:1.7s">Weigh the economic costs</li>
       <li style="animation-delay:2.2s">Test the assumptions, then save and share</li>
     </ol>`,
    'The method: assume how far automation goes; see the financing gap it opens; compare the instruments that could close it, and their rates; weigh the economic costs; test the assumptions, then save and share.',
    5600,
  );
  await w.hideCard();

  // Facts first
  await w.moveTo(page.locator('[data-provenance="observed"]').first());
  await w.caption(
    'Start from the facts',
    'Every number is labelled: observed, derived, calibrated, assumed, simulated or hypothetical.',
  );
  await w.scrollTo(page.getByRole('heading', { name: 'Social Insurance Fund receipts and expenditure' }));
  await page.mouse.move(820, 380, { steps: 20 });
  await w.caption(
    'Start from the facts',
    'Official CYSTAT and Social Insurance Services data: the Fund’s receipts and expenditure, 2015–2025.',
  );

  // Step 1–2: assumption → gap
  await w.nav('Automation simulator', 'Automation simulator');
  await w.caption(
    'Step 1 · Assume how far automation goes',
    'The adoption parameter sets how much of production autonomous capital (AI, robots) can take over. It is an assumption, not a forecast.',
  );
  await w.setAdoption(0.1);
  await w.click(page.getByTestId('run'));
  await done(page);
  await w.scrollTo(page.getByRole('heading', { name: /Steady state at adoption/ }), 70);
  let ls = await stat(page, 'Gross labour share');
  let ss = await stat(page, 'SS contributions / output');
  const tgtText = await page.getByText(/Target = zero-adoption ratio [\d.]+%/).innerText();
  const tgt = /ratio ([\d.]+%)/.exec(tgtText)?.[1] ?? '?';
  await w.caption(
    'Step 2 · See the financing gap',
    `At adoption 0.10, labour earns ${ls} of output, and social-security contributions are ${ss} of output against a target of ${tgt}.`,
  );
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(700);
  await w.setAdoption(0.3);
  await w.click(page.getByTestId('run'));
  await done(page);
  await w.scrollTo(page.getByRole('heading', { name: /Steady state at adoption/ }), 70);
  ls = await stat(page, 'Gross labour share');
  ss = await stat(page, 'SS contributions / output');
  await w.caption(
    'Step 2 · See the financing gap',
    `At adoption 0.30, labour’s share falls to ${ls} and contributions to ${ss} of output.`,
  );
  await w.scrollTo(page.getByText('Social-security contributions as a share of output'), 70);
  await page.mouse.move(900, 330, { steps: 20 });
  await w.caption(
    'Step 2 · See the financing gap',
    'The gap between the line and the dashed target is what a new instrument would have to raise.',
  );

  // Step 3–4: instruments and costs at 0.30
  await w.nav('Policy comparison', 'Compare financing instruments');
  await w.moveTo(page.getByRole('combobox', { name: 'Objective' }));
  await w.caption(
    'Step 3 · Compare instruments',
    'Objective: restore the Fund’s financing target. Each instrument’s rate is solved to raise exactly the missing revenue.',
  );
  await w.click(page.getByRole('button', { name: 'Compare instruments' }));
  await done(page);
  await w.scrollTo(page.getByRole('heading', { name: 'Revenue and status' }), 70);
  const tg = await target(page);
  const at30 = { D: await rate(page, 'D'), E: await rate(page, 'E'), F: await rate(page, 'F') };
  await w.caption(
    'Step 3 · Compare instruments',
    `At adoption 0.30, restoring ${tg} of output takes: an employer contribution on autonomous capital (D) of ${at30.D}, a contribution on value added (E) of ${at30.E}, or a labour-share-adjusted contribution (F) of ${at30.F}.`,
  );
  await w.moveTo(page.getByText('unattainable').first());
  await w.caption(
    'Step 3 · Compare instruments',
    'Instruments that cannot reach the target are flagged, not hidden.',
  );
  await w.scrollTo(page.getByRole('heading', { name: 'Real effects vs no new instrument' }), 70);
  const gdp30 = { D: await gdp(page, 'D'), E: await gdp(page, 'E') };
  await w.caption(
    'Step 4 · Weigh the costs',
    `No option is free. Long-run GDP compared with no new instrument: ${gdp30.D} under D, ${gdp30.E} under E.`,
  );
  await w.scrollTo(page.getByRole('heading', { name: 'Distribution and burden' }), 70);
  await w.caption(
    'Step 4 · Weigh the costs',
    'Distribution and efficiency are reported side by side. There is no single “winner” score.',
  );

  // Changing the assumption
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(800);
  await w.caption(
    'Change the assumption',
    'What if automation goes less far? Move adoption back to 0.10 and compare again.',
    2600,
  );
  await w.setAdoption(0.1);
  await w.click(page.getByRole('button', { name: 'Compare instruments' }));
  await done(page);
  await w.scrollTo(page.getByRole('heading', { name: 'Revenue and status' }), 70);
  const at10 = { D: await rate(page, 'D'), E: await rate(page, 'E'), F: await rate(page, 'F') };
  await w.caption(
    'Change the assumption',
    `At adoption 0.10: D needs ${at10.D}, E ${at10.E}, and F is ${at10.F === 'unattainable' ? 'unattainable' : at10.F}.`,
  );
  const dHigher = parseFloat(at10.D) > parseFloat(at30.D);
  if (dHigher) {
    await w.caption(
      'Change the assumption',
      `D’s rate is higher at low adoption (${at10.D} against ${at30.D}): the gap is smaller, but so is the autonomous capital it taxes.`,
    );
  }
  await w.scrollTo(page.getByRole('heading', { name: 'Real effects vs no new instrument' }), 70);
  const gdp10 = { D: await gdp(page, 'D'), E: await gdp(page, 'E') };
  await w.caption(
    'Change the assumption',
    `The long-run GDP cost shrinks too: ${gdp10.D} under D, ${gdp10.E} under E.`,
  );

  // Step 5: robustness
  await w.nav('Sensitivity & uncertainty', 'Sensitivity and uncertainty');
  await w.click(page.getByRole('tab', { name: 'Policy E and capital mobility' }));
  await w.click(page.getByRole('button', { name: 'Run sensitivity analysis' }));
  await expect(page.getByRole('heading', { name: 'Long run vs short run with capital fixed' })).toBeVisible();
  await w.scrollTo(page.getByRole('heading', { name: 'Long run vs short run with capital fixed' }), 70);
  await w.caption(
    'Step 5 · Test the assumptions',
    'Sensitivity analyses and Monte Carlo bands show how far each conclusion depends on the assumptions, for example long run against short run with capital fixed.',
  );

  // Step 6: save and share
  await w.nav('Report', 'Policy report');
  const name = page.getByLabel('Scenario name');
  await w.moveTo(name);
  await name.fill('');
  await name.pressSequentially('Low automation (adoption 0.10)', { delay: 45 });
  await w.click(page.getByRole('button', { name: 'Save scenario' }));
  await w.click(page.getByRole('button', { name: 'Generate report' }));
  await expect(page.getByTestId('report-preview')).toContainText('What the simulations indicate');
  await w.scrollTo(page.getByTestId('report-preview'), 70);
  await w.caption(
    'Step 6 · Save and share',
    'Save scenarios in your browser and generate a report in Markdown, HTML or PDF to share with colleagues.',
  );
  await w.hideCaption();

  await w.card(
    `<p class="big">Long-run model simulations under stated assumptions, <span class="accent">not forecasts</span>.</p>
     <p class="small">Every number traceable to its source. Runs entirely in your browser: no data leaves it.</p>
     <p class="small accent">vaslabs.github.io/candt4cyprus</p>`,
    'Long-run model simulations under stated assumptions, not forecasts. Every number is traceable to its source, and the tool runs entirely in your browser.',
    5000,
  );
  await rec.stop();
  writeFileSync(join(OUT, 'transcript.json'), JSON.stringify(w.transcript, null, 2) + '\n');
});
