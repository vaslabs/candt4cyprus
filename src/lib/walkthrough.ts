/** Timed transcript of the policy-maker walkthrough video (src/content/policyWalkthrough.json). */
export interface TranscriptEntry {
  /** Position in the video, seconds. */
  readonly t: number;
  readonly step?: string;
  readonly text: string;
}

/** Index of the entry on screen at time t: the last one starting at or before t (−1 before the first). */
export function activeEntry(entries: readonly TranscriptEntry[], t: number): number {
  let i = -1;
  for (let k = 0; k < entries.length; k++) {
    if ((entries[k]?.t ?? Infinity) <= t) i = k;
    else break;
  }
  return i;
}

/** Seconds as m:ss. */
export const mmss = (t: number): string =>
  `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
