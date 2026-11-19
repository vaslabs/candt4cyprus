import { describe, expect, it } from 'vitest';
import { handle } from '../../src/workers/handlers';
import { defaultScenario } from '../../src/economics/simulation/scenario';
import { ARCHETYPES, DEFAULT_FIRM_POLICY } from '../../src/economics/firm/archetypes';

describe('worker request handlers (run in Node, same code as the Web Worker)', () => {
  it('automation: curve, boundary, calibration summary, and progress reports', () => {
    const progress: number[] = [];
    const r = handle(
      { kind: 'automation', scenario: defaultScenario('cyprus'), adoptions: [0, 0.2, 0.4, 0.49] },
      { progress: (d) => progress.push(d) },
    );
    expect(r.presetId).toBe('cyprus-2026');
    expect(r.boundary).toBeCloseTo(0.4825, 3);
    expect(r.curve.map((c) => c.ok)).toEqual([true, true, true, false]); // beyond the boundary: reported, not interpolated
    expect(r.curve[0]!.ssToY).toBeCloseTo(r.target, 12);
    expect(r.calibration?.effectiveSiRate).toBeCloseTo(0.061, 3);
    expect(progress).toEqual([1, 2, 3, 4]);
  });
  it('compare: all instruments with statuses; neutral G unattainable; F regime reported', () => {
    const r = handle({ kind: 'compare', scenario: defaultScenario('cyprus') });
    expect(r.rows.map((x) => x.code)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'G′']);
    expect(r.rows.find((x) => x.code === 'G')!.status).toBe('unattainable');
    expect(
      r.rows.find((x) => x.code === 'F')!.labourShareRegime ?? r.rows.find((x) => x.code === 'F')!.status,
    ).toBeTruthy();
  });
  it('compare honours the fixed-nominal ceiling treatment and the revenue-neutral objective', () => {
    const s = defaultScenario('cyprus');
    const fixed = handle({
      kind: 'compare',
      scenario: { ...s, policy: { ...s.policy, ceiling: 'fixedNominal' } },
    });
    const indexed = handle({ kind: 'compare', scenario: s });
    expect(fixed.rows[0]!.ssToY).not.toBeCloseTo(indexed.rows[0]!.ssToY!, 6);
    const swap = handle({
      kind: 'compare',
      scenario: {
        ...s,
        policy: { ...s.policy, objective: { kind: 'revenueNeutralSwap', replacement: 0.5 } },
      },
    });
    const solved = swap.rows.filter((x) => x.status === 'solved');
    for (const row of solved) expect(row.ssToY!).toBeCloseTo(swap.rows[0]!.ssToY!, 9);
  });
  it('sensitivity bundle and firm comparison', () => {
    const r = handle({ kind: 'sensitivity', scenario: defaultScenario('cyprus') });
    expect(r.coverage).toHaveLength(4);
    expect(r.shortRun.find((x) => x.code === 'E')!.costPerRevenue!).toBeGreaterThan(0);
    expect(r.sectors.length).toBeGreaterThan(5);
    const f = handle({ kind: 'firm', firm: ARCHETYPES[0]!, config: DEFAULT_FIRM_POLICY });
    expect(f.accounts.gva).toBeGreaterThan(0);
  });
  it('monte carlo is reproducible and validates draws', () => {
    const req = {
      kind: 'monteCarlo' as const,
      scenario: defaultScenario('paper'),
      ranges: [{ key: 'elasticityAuto' as const, low: 1.5, high: 2.5 }],
      adoptions: [0.2],
      scheme: 'robotSS' as const,
      draws: 8,
      seed: 3,
    };
    expect(handle(req)).toEqual(handle(req));
    expect(() => handle({ ...req, draws: 0 })).toThrow();
  });
  it('invalid scenarios are rejected with a readable message', () => {
    expect(() => handle({ kind: 'compare', scenario: { ...defaultScenario(), adoption: 5 } })).toThrow(
      /Invalid scenario: adoption/,
    );
  });
});
