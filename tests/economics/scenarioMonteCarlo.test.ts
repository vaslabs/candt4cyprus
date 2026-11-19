import { describe, expect, it } from 'vitest';
import { defaultScenario, parseScenario } from '../../src/economics/simulation/scenario';
import { resolveScenario } from '../../src/economics/simulation/scenarioResolve';
import { mulberry32, quantile, runMonteCarlo } from '../../src/economics/simulation/monteCarlo';
import { solveSteadyStateDual } from '../../src/economics/paper/steadyState';

describe('scenario schema', () => {
  it('round-trips through JSON and resolves for both presets', () => {
    for (const preset of ['paper', 'cyprus'] as const) {
      const s = defaultScenario(preset);
      const back = parseScenario(JSON.parse(JSON.stringify(s)));
      expect(back.ok).toBe(true);
      const r = resolveScenario(s);
      expect(solveSteadyStateDual(r.params).ok).toBe(true);
      expect(r.target).toBeGreaterThan(0);
    }
  });
  it('rejects unknown versions and invalid fields with readable messages', () => {
    expect(parseScenario({ ...defaultScenario(), schemaVersion: 99 })).toMatchObject({ ok: false });
    const bad = parseScenario({ ...defaultScenario(), adoption: 2 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/adoption/);
    expect(parseScenario(null).ok).toBe(false);
  });
  it('Cyprus β override recalibrates with a fixed β; paper variants are honoured', () => {
    const s = defaultScenario('cyprus');
    expect(resolveScenario({ ...s, overrides: { beta: 0.96 } }).params.beta).toBe(0.96);
    expect(resolveScenario({ ...s, betaMode: 'capitalOutput' }).params.beta).toBeCloseTo(0.9223, 4);
    const p = defaultScenario('paper');
    expect(resolveScenario({ ...p, labourSupply: 'figureReplication' }).params.variant.labourSupply).toBe(
      'figureReplication',
    );
  });
});

describe('Monte Carlo', () => {
  it('PRNG is deterministic and uniform-ish', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs.slice(0, 5)).toEqual(Array.from({ length: 5 }, () => b()));
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
  it('quantiles interpolate linearly', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([], 0.5)).toBeNull();
  });
  it('same seed ⇒ identical bands; bands are ordered; cancellation is honoured', () => {
    const spec = {
      scenario: defaultScenario('paper'),
      ranges: [{ key: 'elasticityAuto' as const, low: 1.5, high: 2.5 }],
      adoptions: [0.1, 0.3],
      scheme: 'robotSS' as const,
      draws: 20,
      seed: 7,
    };
    const a = runMonteCarlo(spec);
    const b = runMonteCarlo(spec);
    expect(a).toEqual(b);
    for (const band of [...a.ssToY, ...a.requiredRate]) {
      if (band.p10 !== null) expect(band.p10).toBeLessThanOrEqual(band.p50!);
      if (band.p50 !== null) expect(band.p50).toBeLessThanOrEqual(band.p90!);
    }
    let calls = 0;
    const c = runMonteCarlo(spec, { shouldStop: () => ++calls > 5 });
    expect(c.cancelled).toBe(true);
    expect(c.draws).toBe(5);
  });
});
