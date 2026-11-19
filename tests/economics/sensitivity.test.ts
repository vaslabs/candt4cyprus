import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { paperParameters } from '../../src/economics/paper/calibration';
import { solveSteadyStateDual } from '../../src/economics/paper/steadyState';
import { solveShortRun } from '../../src/economics/simulation/shortRun';
import { comparePolicies } from '../../src/economics/simulation/comparisons';
import { withPolicy } from '../../src/economics/policies/registry';
import { baselineSsTarget } from '../../src/economics/policies/robotTaxes';
import {
  shortRunComparison,
  smeExemptionCoverage,
  sbsSectorScenario,
  valueAddedCoverageSweep,
  withOperatingMargin,
} from '../../src/economics/simulation/sensitivity';
import { firmAccounts } from '../../src/economics/firm/firmModel';
import { ARCHETYPES } from '../../src/economics/firm/archetypes';
import { cyprusStatutoryRules, loadCyprusDataset } from '../../src/economics/cyprus/defaults';
import { paperParams } from '../support/paperArbitraries';

const p = paperParameters('B');

describe('short-run fixed-capital scenario (capital mobility sensitivity)', () => {
  it('without any policy change it reproduces the steady state', () => {
    fc.assert(
      fc.property(paperParams(0.8), (q) => {
        const ss = solveSteadyStateDual(q);
        fc.pre(ss.ok && q.adoption > 0);
        if (!ss.ok) return true;
        const sr = solveShortRun(q, { K: ss.levels.K, D: ss.levels.D });
        return (
          sr.ok &&
          Math.abs(sr.levels.L / ss.levels.L - 1) < 1e-9 &&
          Math.abs(sr.levels.Y / ss.levels.Y - 1) < 1e-9
        );
      }),
      { numRuns: 60 },
    );
  });
  it('with capital fixed, robot taxes and the capital-return levy do not change the allocation; E does', () => {
    const rows = shortRunComparison(p, 0.3, baselineSsTarget(p));
    expect(rows.find((x) => x.code === 'D')!.status).toBe('solved');
    for (const r of rows.filter((x) => ['B', 'C', 'D', 'G′'].includes(x.code) && x.status === 'solved')) {
      expect(Math.abs(r.dL!)).toBeLessThan(1e-9);
      expect(Math.abs(r.costPerRevenue!)).toBeLessThan(1e-9);
    }
    const e = rows.find((x) => x.code === 'E')!;
    expect(e.costPerRevenue!).toBeGreaterThan(0.01); // E's ranking reverses when capital is immobile
  });
  it('rejects policy F (regimes resolved only in the long-run solver)', () => {
    const ss = solveSteadyStateDual({ ...p, adoption: 0.3 });
    if (!ss.ok) throw new Error();
    const r = solveShortRun(withPolicy({ ...p, adoption: 0.3 }, 'labourShare', 0.1), {
      K: ss.levels.K,
      D: ss.levels.D,
    });
    expect(r.ok).toBe(false);
  });
});

describe('objectives and E sensitivities', () => {
  it('E cost per € is invariant to coverage in the representative-firm model (coverage is not a behavioural model)', () => {
    const rows = valueAddedCoverageSweep(p, 0.3, baselineSsTarget(p), [0.3, 0.6, 1]);
    const c = rows.map((r) => r.costPerRevenue!);
    expect(Math.abs(c[0]! - c[2]!)).toBeLessThan(1e-9);
    expect(rows[0]!.rate!).toBeCloseTo(rows[2]!.rate! / 0.3, 9);
  });
  it('revenue-neutral swap keeps SS/Y at its pre-reform level and replaces employer SS', () => {
    const rows = comparePolicies(p, 0.3, { objective: { kind: 'revenueNeutralSwap', replacement: 0.5 } });
    const base = rows[0]!;
    for (const r of rows.filter((x) => x.status === 'solved')) expect(r.ssToY!).toBeCloseTo(base.ssToY!, 10);
    expect(
      withPolicy(p, 'valueAdded', 0.01, { ...await_cfg(), payrollReplacement: 0.5 }).taxes.employerSS,
    ).toBeCloseTo(p.taxes.employerSS / 2, 15);
  });
  it('SME exemption coverage falls as the threshold rises (SBS)', () => {
    const c = (['0-9', '10-19', '20-49', '50-249', 'GE250'] as const).map(
      (s) => smeExemptionCoverage(s).coverage!,
    );
    expect(c[0]).toBeCloseTo(1, 12);
    for (let i = 1; i < c.length; i++) expect(c[i]!).toBeLessThan(c[i - 1]!);
  });
  it('sector scenario: E as a share of operating surplus is higher where labour shares are higher', () => {
    const rows = sbsSectorScenario(0.025, '10-19');
    const m = rows.find((r) => r.nace === 'M')!;
    const j = rows.find((r) => r.nace === 'J')!;
    expect(m.eShareOfGos!).toBeGreaterThan(j.eShareOfGos!);
    expect(rows.find((r) => r.nace === 'L')!.note).toMatch(/confidential/);
  });
  it('margin variants hit the requested EBIT margin, including losses', () => {
    const rules = cyprusStatutoryRules(loadCyprusDataset().dataset);
    for (const m of [0.03, -0.1]) {
      const v = withOperatingMargin(ARCHETYPES[2]!, rules, m);
      expect(firmAccounts(v, rules).operatingMargin).toBeCloseTo(m, 9);
    }
  });
});

function await_cfg() {
  return {
    valueAddedCoverage: 1,
    labourShareBenchmark: 0.5,
    labourShareCoverage: 1,
    excessProfitAllowance: 'neutral' as const,
    capitalReturnLevyFraction: 0.5,
    payrollReplacement: 0,
  };
}
