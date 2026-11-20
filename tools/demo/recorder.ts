/**
 * Full-resolution frame recorder for the demo videos (not part of the test suite).
 * Uses the Chrome DevTools screencast: each JPEG frame is written with its timestamp, and stop()
 * writes an ffmpeg concat list in which every frame lasts until the next one arrived.
 */
import type { CDPSession, Page } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export class Recorder {
  private readonly stamps: { file: string; t: number }[] = [];
  private cdp: CDPSession | null = null;
  private t0 = 0;

  constructor(
    private readonly page: Page,
    private readonly outDir: string,
    private readonly max: { width: number; height: number },
  ) {}

  async start() {
    const frames = join(this.outDir, 'frames');
    rmSync(this.outDir, { recursive: true, force: true });
    mkdirSync(frames, { recursive: true });
    const cdp = await this.page.context().newCDPSession(this.page);
    this.cdp = cdp;
    cdp.on('Page.screencastFrame', (f) => {
      const file = `${String(this.stamps.length).padStart(5, '0')}.jpg`;
      writeFileSync(join(frames, file), Buffer.from(f.data, 'base64'));
      const t = f.metadata.timestamp ?? Date.now() / 1000;
      if (this.stamps.length === 0) this.t0 = t;
      this.stamps.push({ file, t });
      void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => undefined);
    });
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 92,
      maxWidth: this.max.width,
      maxHeight: this.max.height,
      everyNthFrame: 1,
    });
  }

  /** Seconds since the first captured frame (0 before it arrives), i.e. the position in the video. */
  elapsed() {
    return this.t0 ? Math.max(0, Date.now() / 1000 - this.t0) : 0;
  }

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
    writeFileSync(join(this.outDir, 'frames.txt'), lines.join('\n') + '\n');
  }
}
