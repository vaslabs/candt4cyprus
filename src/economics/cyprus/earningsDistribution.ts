/**
 * Bridge from per-person statutory ceilings to an effective rate on the aggregate wage bill.
 *
 * ASSUMPTION (not an official statistic): annual earnings X of employees are lognormal with mean
 * m and log-standard deviation s. Then, for a per-person ceiling c,
 *   E[min(X, c)] = m·Φ((ln c − μ − s²)/s) + c·(1 − Φ((ln c − μ)/s)),   μ = ln m − s²/2,
 * and the insurable share of the wage bill is E[min(X, c)] / m. The effective contribution rate
 * on the wage bill is (statutory rate) × (insurable share).
 *
 * This makes the effective rate depend on the wage LEVEL relative to the ceiling, which is why
 * Proposition 1 (ratio invariance) does not carry over to Cyprus when the ceiling is fixed in
 * euros while model wages change.
 */
import { normalCdf } from '../core/normal';

export interface LognormalEarnings {
  /** Mean annual earnings (€). */
  readonly mean: number;
  /** Standard deviation of log earnings (> 0). */
  readonly logSd: number;
}

/** Share of the wage bill below a per-person ceiling c: E[min(X,c)]/E[X]. */
export function insurableShare(dist: LognormalEarnings, ceiling: number): number {
  const { mean: m, logSd: s } = dist;
  if (!(m > 0 && s > 0 && ceiling > 0)) throw new RangeError('mean, logSd and ceiling must be > 0');
  const mu = Math.log(m) - (s * s) / 2;
  const z = (Math.log(ceiling) - mu) / s;
  return normalCdf(z - s) + (ceiling / m) * (1 - normalCdf(z));
}

/** Share of employees with earnings above the ceiling. */
export function shareAboveCeiling(dist: LognormalEarnings, ceiling: number): number {
  const mu = Math.log(dist.mean) - (dist.logSd * dist.logSd) / 2;
  return 1 - normalCdf((Math.log(ceiling) - mu) / dist.logSd);
}

/** Log-sd implied by a mean/median ratio: mean/median = exp(s²/2). */
export function logSdFromMeanMedian(mean: number, median: number): number {
  if (!(mean > median && median > 0)) throw new RangeError('lognormal requires mean > median > 0');
  return Math.sqrt(2 * Math.log(mean / median));
}

export interface EarningsBand {
  /** Lower bound (€/period). */
  readonly from: number;
  /** Upper bound (€/period), null for the open top band. */
  readonly to: number | null;
  /** Share of employees in the band (fractions summing to ≈1). */
  readonly share: number;
}

/**
 * Tail-free estimate of E[min(X,c)]/E[X] from a banded distribution and the published mean.
 * Earnings are assumed uniform within each band. Only bands below the ceiling need a level;
 * above the ceiling every person contributes exactly c, so the open top band's mean is not needed.
 */
export function insurableShareFromBands(
  bands: readonly EarningsBand[],
  mean: number,
  ceiling: number,
): number {
  const totalShare = bands.reduce((s, b) => s + b.share, 0);
  if (Math.abs(totalShare - 1) > 0.01) throw new RangeError(`band shares sum to ${totalShare}, expected 1`);
  let capped = 0;
  for (const b of bands) {
    const w = b.share / totalShare;
    if (b.to === null || b.to > ceiling) {
      if (b.from >= ceiling) capped += w * ceiling;
      else {
        // band straddles the ceiling: uniform on [from, to]
        const to = b.to ?? ceiling;
        const below = (ceiling - b.from) / (to - b.from);
        capped += w * ((below * (b.from + ceiling)) / 2 + (1 - below) * ceiling);
      }
    } else {
      capped += w * ((b.from + b.to) / 2);
    }
  }
  return capped / mean;
}

/** Share of employees at or above the ceiling implied by bands (uniform within the straddling band). */
export function shareAboveFromBands(bands: readonly EarningsBand[], ceiling: number): number {
  let s = 0;
  for (const b of bands) {
    if (b.from >= ceiling) s += b.share;
    else if (b.to === null || b.to > ceiling) {
      const to = b.to ?? ceiling;
      s += (b.share * (to - ceiling)) / (to - b.from);
    }
  }
  return s;
}
