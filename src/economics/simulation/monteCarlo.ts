/**
 * Monte Carlo uncertainty analysis with explicit parameter distributions and a reproducible seed.
 * Each draw samples the structural assumptions uniformly from their documented sensitivity ranges
 * (src/data/cyprus2026.json `sensitivityRange`, or user ranges), re-resolves the scenario (for Cyprus
 * this re-runs the calibration), and records outcomes across the adoption grid. Bands are empirical
 * quantiles of the draws: they reflect only the stated parameter uncertainty, not model uncertainty.
 */
import { solveSteadyStateDual } from '../paper/steadyState';
import { solveRequiredRate, withPolicy, type ActiveScheme } from '../policies/registry';
import { resolveScenario } from './scenarioResolve';
import type { Scenario } from './scenario';

/** mulberry32: small, fast, deterministic PRNG (period 2^32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ParameterRange {
  readonly key: 'elasticityKL' | 'elasticityAuto' | 'deltaD' | 'beta';
  readonly low: number;
  readonly high: number;
}

export interface MonteCarloSpec {
  readonly scenario: Scenario;
  readonly ranges: readonly ParameterRange[];
  readonly adoptions: readonly number[];
  readonly scheme: ActiveScheme | null;
  readonly draws: number;
  readonly seed: number;
}

export interface QuantileBand {
  readonly adoption: number;
  readonly p10: number | null;
  readonly p50: number | null;
  readonly p90: number | null;
  readonly valid: number;
  readonly failed: number;
}

export interface MonteCarloResult {
  readonly ssToY: readonly QuantileBand[];
  readonly requiredRate: readonly QuantileBand[];
  readonly draws: number;
  readonly seed: number;
  readonly cancelled: boolean;
}

export function quantile(sorted: readonly number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const a = sorted[Math.floor(pos)] ?? NaN;
  const b = sorted[Math.ceil(pos)] ?? NaN;
  return a + (b - a) * (pos - Math.floor(pos));
}

export function runMonteCarlo(
  spec: MonteCarloSpec,
  hooks: { progress?: (done: number, total: number) => void; shouldStop?: () => boolean } = {},
): MonteCarloResult {
  const rng = mulberry32(spec.seed);
  // One accumulator per adoption level.
  const acc = spec.adoptions.map((adoption) => ({
    adoption,
    ss: [] as number[],
    rate: [] as number[],
    ssFail: 0,
    rateFail: 0,
  }));
  let done = 0;
  let cancelled = false;
  for (let d = 0; d < spec.draws; d++) {
    if (hooks.shouldStop?.()) {
      cancelled = true;
      break;
    }
    const overrides: Scenario['overrides'] = { ...spec.scenario.overrides };
    const drawn: Partial<Record<ParameterRange['key'], number>> = {};
    for (const r of spec.ranges) drawn[r.key] = r.low + (r.high - r.low) * rng();
    Object.assign(overrides, drawn);
    let resolved;
    try {
      resolved = resolveScenario({ ...spec.scenario, overrides });
    } catch {
      for (const a of acc) {
        a.ssFail++;
        a.rateFail++;
      }
      done++;
      continue;
    }
    for (const a of acc) {
      const p = { ...resolved.params, adoption: a.adoption };
      const base = solveSteadyStateDual(withPolicy(p, 'none', 0));
      if (base.ok) a.ss.push(base.ssToGdp);
      else a.ssFail++;
      if (spec.scheme) {
        const r = solveRequiredRate(p, spec.scheme, spec.scenario.policy.config, {
          target: resolved.target,
          scanIntervals: 150,
        });
        if (r.status === 'solved' || r.status === 'not-needed') a.rate.push(r.rate);
        else a.rateFail++;
      }
    }
    done++;
    hooks.progress?.(done, spec.draws);
  }
  const band = (key: 'ss' | 'rate'): QuantileBand[] =>
    acc.map((a) => {
      const v = [...a[key]].sort((x, y) => x - y);
      return {
        adoption: a.adoption,
        p10: quantile(v, 0.1),
        p50: quantile(v, 0.5),
        p90: quantile(v, 0.9),
        valid: v.length,
        failed: key === 'ss' ? a.ssFail : a.rateFail,
      };
    });
  return { ssToY: band('ss'), requiredRate: band('rate'), draws: done, seed: spec.seed, cancelled };
}
