/**
 * Vertical (1080×1920) Instagram story with Greek captions, recorded from the production build.
 * Frames are captured at full resolution with the Chrome DevTools screencast, then
 * assembled into an MP4 by makeStory.sh. Captions and title cards are injected
 * overlays; the app itself is unchanged.
 *
 * Layout respects Instagram story safe zones: nothing important in the top ~14%
 * or bottom ~20% of the frame.
 */
import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, 'out', 'story');
const FRAMES = join(OUT, 'frames');

const OVERLAY = `
(() => {
  const install = () => {
    if (document.getElementById('st-caption')) return;
    const style = document.createElement('style');
    style.textContent = \`
      #st-caption{position:fixed;left:20px;right:20px;bottom:205px;z-index:99999;padding:14px 18px;
        border-radius:16px;background:rgba(15,23,42,.93);color:#f8fafc;text-align:center;
        font:700 22px/1.32 Inter,system-ui,sans-serif;box-shadow:0 10px 34px rgba(0,0,0,.4);
        transition:opacity .35s, transform .35s;pointer-events:none}
      #st-caption.hide{opacity:0;transform:translateY(12px)}
      #st-card{position:fixed;inset:0;z-index:100001;display:flex;flex-direction:column;justify-content:center;
        gap:22px;padding:150px 38px 220px;color:#f8fafc;
        background:radial-gradient(120% 80% at 20% 10%,#115e59 0%,#0f172a 55%,#020617 100%);
        font:600 30px/1.3 Inter,system-ui,sans-serif;transition:opacity .45s;pointer-events:none}
      #st-card.hide{opacity:0}
      #st-card .big{font:800 40px/1.18 Inter,system-ui,sans-serif;letter-spacing:-.01em}
      #st-card .accent{color:#5eead4}
      #st-card .small{font:500 21px/1.4 Inter,system-ui,sans-serif;color:#cbd5e1}
      #st-card ul{list-style:none;margin:0;padding:0;display:grid;gap:14px;font:600 24px/1.3 Inter,system-ui,sans-serif}
      #st-card li{display:flex;gap:12px;align-items:flex-start;opacity:0;transform:translateY(10px);
        animation:st-in .45s forwards}
      #st-card li::before{content:'✓';color:#5eead4;font-weight:800}
      #st-card .tag{font:700 19px/1 Inter,system-ui,sans-serif;color:#5eead4;letter-spacing:.08em}
      @keyframes st-in{to{opacity:1;transform:none}}
      #st-cursor{position:fixed;z-index:100000;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;
        background:rgba(13,148,136,.35);border:3px solid #0f766e;pointer-events:none;transition:transform .12s}
      #st-cursor.down{transform:scale(.7);background:rgba(13,148,136,.75)}\`;
    document.head.appendChild(style);
    const cap = document.createElement('div'); cap.id = 'st-caption'; cap.className = 'hide';
    const card = document.createElement('div'); card.id = 'st-card'; card.className = 'hide';
    const cur = document.createElement('div'); cur.id = 'st-cursor'; cur.style.left = '-60px';
    document.body.append(cap, card, cur);
    addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => cur.classList.add('down'), true);
    addEventListener('mouseup', () => cur.classList.remove('down'), true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', install); else install();
})();`;

/** Records Chrome screencast frames (JPEG, full device resolution) with their timestamps. */
class Recorder {
  private readonly stamps: { file: string; t: number }[] = [];
  private cdp: CDPSession | null = null;
  constructor(private readonly page: Page) {}

  async start() {
    rmSync(OUT, { recursive: true, force: true });
    mkdirSync(FRAMES, { recursive: true });
    const cdp = await this.page.context().newCDPSession(this.page);
    this.cdp = cdp;
    cdp.on('Page.screencastFrame', (f) => {
      const file = `${String(this.stamps.length).padStart(5, '0')}.jpg`;
      writeFileSync(join(FRAMES, file), Buffer.from(f.data, 'base64'));
      this.stamps.push({ file, t: f.metadata.timestamp ?? Date.now() / 1000 });
      void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => undefined);
    });
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 92,
      maxWidth: 1080,
      maxHeight: 1920,
      everyNthFrame: 1,
    });
  }

  /** Writes an ffmpeg concat list where each frame lasts until the next one arrived. */
  async stop() {
    await this.cdp?.send('Page.stopScreencast');
    const end = Date.now() / 1000;
    const lines: string[] = [];
    this.stamps.forEach((s, i) => {
      const next = this.stamps[i + 1]?.t ?? end;
      lines.push(`file 'frames/${s.file}'`, `duration ${Math.max(0.001, next - s.t).toFixed(4)}`);
    });
    const last = this.stamps[this.stamps.length - 1];
    if (last) lines.push(`file 'frames/${last.file}'`); // concat demuxer needs the last file repeated
    writeFileSync(join(OUT, 'frames.txt'), lines.join('\n') + '\n');
  }
}

class Story {
  constructor(readonly page: Page) {}

  async caption(text: string, holdMs = 2800) {
    await this.page.evaluate((t) => {
      const el = document.getElementById('st-caption');
      if (!el) return;
      el.textContent = t;
      el.classList.toggle('hide', !t);
    }, text);
    await this.page.waitForTimeout(holdMs);
  }

  async card(html: string, holdMs: number) {
    await this.page.evaluate((h) => {
      const el = document.getElementById('st-card');
      if (!el) return;
      el.innerHTML = h;
      el.classList.remove('hide');
    }, html);
    await this.page.waitForTimeout(holdMs);
  }

  async hideCard() {
    await this.page.evaluate(() => document.getElementById('st-card')?.classList.add('hide'));
    await this.page.waitForTimeout(450);
  }

  async go(hash: string, heading: string) {
    await this.caption('', 250);
    await this.page.evaluate(() => scrollTo({ top: 0 }));
    await this.page.goto(`./${hash}`);
    await expect(this.page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }

  async moveTo(target: Locator) {
    await target.scrollIntoViewIfNeeded();
    const b = await target.boundingBox();
    if (!b) return;
    await this.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 16 });
    await this.page.waitForTimeout(200);
  }

  async click(target: Locator) {
    await this.moveTo(target);
    await target.click();
    await this.page.waitForTimeout(300);
  }

  async scrollTo(target: Locator, offset = 140) {
    const y = await target.evaluate((el, off) => el.getBoundingClientRect().top + scrollY - off, offset);
    await this.page.evaluate((top) => scrollTo({ top, behavior: 'smooth' }), y);
    await this.page.waitForTimeout(1000);
  }
}

const done = (page: Page) => expect(page.getByTestId('run-status')).toContainText('Done');

test('instagram-story', async ({ page }) => {
  await page.addInitScript(OVERLAY);
  const s = new Story(page);
  await s.go('', 'Cyprus Social Insurance and automation');
  // The opening card is in place before the first frame is captured.
  await page.evaluate(() => {
    const el = document.getElementById('st-card');
    if (el) el.style.transition = 'none';
  });
  await s.card('', 0);
  await page.evaluate(() => {
    const el = document.getElementById('st-card');
    if (el) el.style.transition = '';
  });
  const rec = new Recorder(page);
  await rec.start();

  // 1. The claim
  await s.card(
    `<p class="big">Πολλή δημόσια συζήτηση για το <span class="accent">συνταξιοδοτικό</span>…</p>`,
    2200,
  );
  await s.card(
    `<p class="big">Πολλή δημόσια συζήτηση για το <span class="accent">συνταξιοδοτικό</span>…</p>
     <p>…αλλά ποιος μιλά για τον ελέφαντα στο δωμάτιο;</p>
     <p class="big accent">Τεχνητή νοημοσύνη &amp; αυτοματοποίηση</p>`,
    3300,
  );
  await s.card(
    `<p class="tag">ΤΟ ΕΠΙΧΕΙΡΗΜΑ, ΣΕ ΕΡΓΑΛΕΙΟ</p>
     <p class="big">Ένας προσομοιωτής για το Ταμείο Κοινωνικών Ασφαλίσεων της Κύπρου</p>
     <p class="small">Βασισμένος στη μελέτη Casas &amp; Torres (2026), Hacienda Pública Española</p>`,
    3000,
  );
  await s.hideCard();

  // 2. Real data
  await s.caption('Πραγματικά δεδομένα: ΚΥΣΤΑΤ και Υπηρεσίες Κοινωνικών Ασφαλίσεων', 1800);
  await s.scrollTo(
    page.getByRole('heading', { name: 'Social Insurance Fund receipts and expenditure' }),
    120,
  );
  await s.caption('Έσοδα και δαπάνες του Ταμείου, 2015–2025', 2200);

  // 3. The problem
  await s.go('#/automation', 'Automation simulator');
  await s.caption('Τι γίνεται όταν το AI αυξάνει την παραγωγή αλλά μειώνει το μερίδιο της εργασίας;', 1000);
  const slider = page.getByRole('slider', { name: 'Autonomous-capital adoption parameter' });
  await s.moveTo(slider);
  await slider.focus();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(500);
  await s.click(page.getByTestId('run'));
  await done(page);
  await s.scrollTo(page.getByText('Social-security contributions as a share of output'), 120);
  await page.mouse.move(300, 420, { steps: 14 });
  await s.caption('Χωρίς νέα μέτρα, οι εισφορές πέφτουν κάτω από τον στόχο του Ταμείου', 3000);

  // 4. Comparing policies
  await s.go('#/policies', 'Compare financing instruments');
  await s.caption('Συγκρίνουμε 7 τρόπους χρηματοδότησης με το ίδιο κριτήριο', 600);
  await s.click(page.getByRole('button', { name: 'Compare instruments' }));
  await done(page);
  await s.scrollTo(page.getByRole('heading', { name: 'Revenue and status' }), 120);
  await page.waitForTimeout(800);
  await s.scrollTo(
    page.getByRole('heading', { name: 'Change in GDP, investment and working time by instrument' }),
    120,
  );
  await s.caption('Καμία λύση δεν είναι δωρεάν: το εργαλείο δείχνει ανοιχτά το κόστος της καθεμιάς', 3000);

  // 5. Grounded in research
  await s.go('#/replication', 'Paper replication explorer');
  await s.click(page.getByRole('button', { name: 'Run replication' }));
  await done(page);
  await s.scrollTo(page.getByRole('heading', { name: /Benchmarks: 17 of 21 pass/ }), 160);
  await s.caption('Αναπαράγει τη δημοσιευμένη μελέτη: 17 από 21 αποτελέσματα επιβεβαιώνονται', 3000);

  // 6. How it was built
  await s.caption('', 0);
  await s.card(
    `<p class="tag">ΠΩΣ ΦΤΙΑΧΤΗΚΕ</p>
     <p class="big">Σε <span class="accent">2–3 ώρες</span>, με κώδικα γραμμένο από τεχνητή νοημοσύνη</p>
     <ul>
       <li style="animation-delay:.5s">294 αυτόματοι έλεγχοι (tests)</li>
       <li style="animation-delay:1.1s">12 έλεγχοι της εφαρμογής στον browser</li>
       <li style="animation-delay:1.7s">Επαλήθευση των μαθηματικών με ανεξάρτητη βιβλιοθήκη (Python/SciPy)</li>
       <li style="animation-delay:2.3s">Κάθε αριθμός με την πηγή του</li>
     </ul>`,
    5200,
  );

  // 8. The point
  await s.card(
    `<p class="big">Μπορούμε να δοκιμάζουμε <span class="accent">πολιτικές</span> και <span class="accent">επιστημονικές μελέτες</span> πολύ πιο γρήγορα.</p>`,
    3200,
  );
  await s.card(
    `<p class="big">Ακόμα και αυτό το video δημιουργήθηκε με κώδικα που έγραψε <span class="accent">τεχνητή νοημοσύνη</span>.</p>
     <p class="small">vaslabs.github.io/candt4cyprus</p>`,
    4200,
  );
  await rec.stop();
});
