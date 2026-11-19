import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { erfc, normalCdf } from '../../src/economics/core/normal';
import {
  insurableShare,
  logSdFromMeanMedian,
  shareAboveCeiling,
} from '../../src/economics/cyprus/earningsDistribution';

describe('normal CDF', () => {
  it('matches reference values', () => {
    expect(normalCdf(0)).toBe(0.5);
    expect(normalCdf(1.959963984540054)).toBeCloseTo(0.975, 14);
    expect(normalCdf(-1)).toBeCloseTo(0.15865525393145707, 14);
    expect(erfc(0.5)).toBeCloseTo(0.4795001221869535, 14);
    expect(erfc(3)).toBeCloseTo(2.209049699858544e-5, 18);
    expect(erfc(6) / 2.1519736712498913e-17).toBeCloseTo(1, 12);
  });
  it('is monotone, symmetric and within [0,1]', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -30, max: 30, noNaN: true }),
        fc.double({ min: 0, max: 5, noNaN: true }),
        (x, h) => {
          const a = normalCdf(x);
          return a >= 0 && a <= 1 && normalCdf(x + h) >= a && Math.abs(a + normalCdf(-x) - 1) < 1e-15;
        },
      ),
    );
  });
});

/** Independent check by numerical integration of E[min(X,c)] over the lognormal density. */
function insurableShareNumeric(m: number, s: number, c: number): number {
  const mu = Math.log(m) - (s * s) / 2;
  const n = 20000;
  const lo = mu - 10 * s;
  const hi = mu + 10 * s;
  const h = (hi - lo) / n;
  let acc = 0;
  for (let i = 0; i <= n; i++) {
    const t = lo + i * h; // t = ln x, density of t is normal(mu, s)
    const w = i === 0 || i === n ? 0.5 : 1;
    const pdf = Math.exp(-((t - mu) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
    acc += w * Math.min(Math.exp(t), c) * pdf;
  }
  return (acc * h) / m;
}

describe('insurable share of the wage bill (lognormal assumption)', () => {
  it('agrees with numerical integration', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 10000, max: 80000, noNaN: true }),
        fc.double({ min: 0.2, max: 1.2, noNaN: true }),
        fc.double({ min: 20000, max: 200000, noNaN: true }),
        (m, s, c) =>
          Math.abs(insurableShare({ mean: m, logSd: s }, c) - insurableShareNumeric(m, s, c)) < 1e-6,
      ),
      { numRuns: 50 },
    );
  });
  it('is in (0,1], increasing in the ceiling, decreasing in the mean wage', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 5000, max: 100000, noNaN: true }),
        fc.double({ min: 0.1, max: 1.5, noNaN: true }),
        fc.double({ min: 5000, max: 300000, noNaN: true }),
        fc.double({ min: 1.01, max: 3, noNaN: true }),
        (m, s, c, k) => {
          const d = { mean: m, logSd: s };
          const v = insurableShare(d, c);
          return (
            v > 0 &&
            v <= 1 + 1e-12 &&
            insurableShare(d, c * k) >= v - 1e-12 &&
            insurableShare({ mean: m * k, logSd: s }, c) <= v + 1e-12
          );
        },
      ),
    );
  });
  it('is invariant to scaling mean and ceiling together (ceiling indexed to wages)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 5000, max: 1e5, noNaN: true }),
        fc.double({ min: 0.1, max: 1.5, noNaN: true }),
        fc.double({ min: 0.2, max: 5, noNaN: true }),
        (m, s, k) => {
          const c = 2.4 * m;
          return (
            Math.abs(
              insurableShare({ mean: m, logSd: s }, c) - insurableShare({ mean: k * m, logSd: s }, k * c),
            ) < 1e-12
          );
        },
      ),
    );
  });
  it('helpers: share above ceiling and log-sd from mean/median', () => {
    expect(shareAboveCeiling({ mean: 30000, logSd: 0.6 }, 1e12)).toBeLessThan(1e-12);
    const s = logSdFromMeanMedian(30000, 25000);
    expect(Math.exp((s * s) / 2)).toBeCloseTo(1.2, 12);
    expect(() => logSdFromMeanMedian(1, 2)).toThrow();
    expect(() => insurableShare({ mean: 0, logSd: 1 }, 1)).toThrow();
  });
});

import {
  insurableShareFromBands,
  shareAboveFromBands,
} from '../../src/economics/cyprus/earningsDistribution';
describe('band-based insurable share (tail-free)', () => {
  const bands = [
    { from: 0, to: 1000, share: 0.5 },
    { from: 1000, to: 3000, share: 0.3 },
    { from: 3000, to: null, share: 0.2 },
  ];
  it('hand-computed: ceiling 2000 straddling the middle band', () => {
    // below: 0.5×500; middle: half below (avg 1500) half at 2000 → 0.3×(0.5×1500+0.5×2000); top: 0.2×2000
    const expected = (0.5 * 500 + 0.3 * 1750 + 0.2 * 2000) / 1500;
    expect(insurableShareFromBands(bands, 1500, 2000)).toBeCloseTo(expected, 12);
    expect(shareAboveFromBands(bands, 2000)).toBeCloseTo(0.15 + 0.2, 12);
  });
  it('rejects shares that do not sum to 1', () => {
    expect(() => insurableShareFromBands([{ from: 0, to: null, share: 0.5 }], 1, 1)).toThrow();
  });
});
