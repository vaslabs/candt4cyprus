import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { paperParameters } from '../../src/economics/paper/calibration';
import { solveSteadyStateDual } from '../../src/economics/paper/steadyState';
import { solveSteadyStateNewton } from '../../src/economics/paper/fullSystem';
import { neutralExcessProfitAllowance } from '../../src/economics/paper/households';
import type { PaperParameters, SteadyStateLevels, SteadyStateResult } from '../../src/economics/paper/types';
import {
  coverageAfterExemptions,
  DEFAULT_POLICY_CONFIG,
  solveRequiredRate,
  withPolicy,
} from '../../src/economics/policies/registry';
import { baselineSsTarget } from '../../src/economics/policies/robotTaxes';
import { comparePolicies } from '../../src/economics/simulation/comparisons';
import { paperParams } from '../support/paperArbitraries';
import { relErr } from '../support/arbitraries';

type Ok = Extract<SteadyStateResult, { ok: true }>;
const ok = (r: SteadyStateResult): Ok => {
  if (!r.ok) throw new Error(`${r.reason}: ${r.detail}`);
  return r;
};
const KEYS = ['Y', 'C', 'K', 'D', 'L', 'W', 'I', 'Rk', 'Rd'] as const;
const maxRel = (a: SteadyStateLevels, b: SteadyStateLevels) =>
  Math.max(...KEYS.map((k) => (a[k] === b[k] ? 0 : relErr(a[k], b[k]))));
const d = (min: number, max: number) => fc.double({ min, max, noNaN: true });

/** Random valid parameters with a random E, F or G extension that keeps a steady state. */
const extParams = paperParams(0.85).chain((p) =>
  fc
    .oneof(
      fc.record({ rate: d(0, 0.1), coverage: d(0.3, 1) }).map((valueAdded) => ({ valueAdded })),
      fc
        .record({ rate: d(0, 0.6), benchmark: d(0.2, 0.9), coverage: d(0.3, 1) })
        .map((labourShare) => ({ labourShare })),
      fc.record({ rate: d(0, 0.4), frac: d(0, 1.5) }).map(({ rate, frac }) => ({
        excessProfit: { rate, normalReturn: frac * neutralExcessProfitAllowance(p) },
      })),
    )
    .map((extensions) => ({ ...p, extensions }) as PaperParameters),
);

describe('exploratory extensions leave the replication unchanged when inactive', () => {
  it('empty / zero-rate extensions give identical results', () => {
    fc.assert(
      fc.property(paperParams(), (p) => {
        const a = ok(solveSteadyStateDual(p));
        const zero = {
          ...p,
          extensions: {
            valueAdded: { rate: 0, coverage: 1 },
            labourShare: { rate: 0, benchmark: 0.5, coverage: 1 },
            excessProfit: { rate: 0, normalReturn: 0 },
          },
        };
        const b = ok(solveSteadyStateDual(zero));
        return maxRel(a.levels, b.levels) === 0 && a.ssToGdp === b.ssToGdp;
      }),
    );
  });
});

describe('extended model: accounting and differential tests', () => {
  it('zero profit (incl. E, F), resource constraint and household budget (incl. G) hold', () => {
    fc.assert(
      fc.property(extParams, (p) => {
        const r = solveSteadyStateDual(p);
        fc.pre(r.ok);
        const g = (r as Ok).diagnostics;
        return (
          Math.abs(g.eulerResidual) < 1e-11 &&
          Math.abs(g.resourceResidual) < 1e-11 &&
          Math.abs(g.householdBudgetResidual) < 1e-10
        );
      }),
    );
  });
  it('net factor shares sum to one with firm-paid contributions excluded', () => {
    fc.assert(
      fc.property(extParams, (p) => {
        const r = solveSteadyStateDual(p);
        fc.pre(r.ok);
        const s = (r as Ok).shares;
        return Math.abs(s.netLabour + s.netTraditionalCapital + s.netAutonomousCapital - 1) < 1e-11;
      }),
    );
  });
  it('Solver 2 (Newton, independently written policy FOCs) agrees with Solver 1 to 1e-9', () => {
    fc.assert(
      fc.property(extParams, (p) => {
        const a = solveSteadyStateDual(p);
        fc.pre(a.ok && (a as Ok).diagnostics.regimes.labourShare !== 'kink');
        const b = solveSteadyStateNewton(p);
        return (
          b.ok &&
          maxRel((a as Ok).levels, b.levels) < 1e-9 &&
          b.diagnostics.regimes.labourShare === (a as Ok).diagnostics.regimes.labourShare
        );
      }),
      { numRuns: 40 },
    );
  });
});

describe('policy G (excess profit)', () => {
  it('is exactly neutral (zero revenue, unchanged allocation) when the allowance equals the required return', () => {
    fc.assert(
      fc.property(paperParams(), d(0.01, 0.5), (p0, rate) => {
        // Condition: no robot-specific taxes, so both capitals share the same required return.
        const p = { ...p0, taxes: { ...p0.taxes, robotIncome: 0, robotInvestment: 0, robotSS: 0 } };
        const a0 = solveSteadyStateDual(p);
        fc.pre(a0.ok);
        const a = ok(a0);
        const b = ok(
          solveSteadyStateDual({
            ...p,
            extensions: { excessProfit: { rate, normalReturn: neutralExcessProfitAllowance(p) } },
          }),
        );
        return (
          maxRel(a.levels, b.levels) < 1e-13 &&
          Math.abs(b.government.excessProfitContribution) < 1e-13 * b.levels.Y
        );
      }),
    );
  });
  it('with a robot income tax, one allowance cannot be neutral for both capitals (G bites on D)', () => {
    const p = paperParameters('B', {
      adoption: 0.2,
      taxes: { ...paperParameters('B').taxes, robotIncome: 0.2 },
    });
    const r = ok(
      solveSteadyStateDual({
        ...p,
        extensions: { excessProfit: { rate: 0.2, normalReturn: neutralExcessProfitAllowance(p) } },
      }),
    );
    expect(r.diagnostics.regimes).toMatchObject({ excessProfitK: 'non-binding', excessProfitD: 'binding' });
    expect(r.government.excessProfitContribution).toBeGreaterThan(0);
  });
  it('with an allowance below the required return it acts like a capital tax (raises revenue, lowers K)', () => {
    const p = paperParameters('B', { adoption: 0.2 });
    const a = ok(solveSteadyStateDual(p));
    const b = ok(
      solveSteadyStateDual({
        ...p,
        extensions: { excessProfit: { rate: 0.3, normalReturn: 0.5 * neutralExcessProfitAllowance(p) } },
      }),
    );
    expect(b.government.excessProfitContribution).toBeGreaterThan(0);
    expect(b.levels.K).toBeLessThan(a.levels.K);
    expect(b.diagnostics.regimes).toMatchObject({ excessProfitK: 'binding', excessProfitD: 'binding' });
  });
});

describe('policy E (value added) and F (labour share): metamorphic and regime tests', () => {
  it('E at rate e with coverage c ≡ E at rate e·c with full coverage', () => {
    fc.assert(
      fc.property(paperParams(0.8), d(0, 0.1), d(0.2, 1), (p, e, c) => {
        const a = solveSteadyStateDual({ ...p, extensions: { valueAdded: { rate: e, coverage: c } } });
        const b = solveSteadyStateDual({ ...p, extensions: { valueAdded: { rate: e * c, coverage: 1 } } });
        return a.ok === b.ok && (!a.ok || maxRel(a.levels, (b as Ok).levels) < 1e-12);
      }),
    );
  });
  it('binding F ≡ a value-added levy at τ_F·c·s̄ plus a labour-cost credit of τ_F·c (same allocation)', () => {
    fc.assert(
      fc.property(paperParams(0.8), d(0.01, 0.5), d(0.3, 1), (p, tau, c) => {
        const F = solveSteadyStateDual({
          ...p,
          extensions: { labourShare: { rate: tau, benchmark: 0.99, coverage: c } },
        });
        fc.pre(F.ok && (F as Ok).diagnostics.regimes.labourShare === 'binding');
        const sse = (1 + p.taxes.employerSS) * (1 - tau * c) - 1;
        const equiv = solveSteadyStateDual({
          ...p,
          taxes: { ...p.taxes, employerSS: sse },
          extensions: { valueAdded: { rate: tau * c * 0.99, coverage: 1 } },
        });
        return equiv.ok && maxRel((F as Ok).levels, equiv.levels) < 1e-11;
      }),
    );
  });
  it('non-binding F (benchmark below the labour share) raises nothing and changes nothing', () => {
    const p = paperParameters('B', { adoption: 0.2 });
    const a = ok(solveSteadyStateDual(p));
    const b = ok(
      solveSteadyStateDual({ ...p, extensions: { labourShare: { rate: 0.3, benchmark: 0.1, coverage: 1 } } }),
    );
    expect(b.diagnostics.regimes.labourShare).toBe('non-binding');
    expect(b.government.labourShareContribution).toBe(0);
    expect(maxRel(a.levels, b.levels)).toBe(0);
  });
  it('kink: firms bunch exactly at the benchmark and the contribution raises zero', () => {
    const p = paperParameters('B', { adoption: 0.2 });
    const base = ok(solveSteadyStateDual(p)).diagnostics.labourCostShare;
    const bind = ok(
      solveSteadyStateDual({
        ...p,
        extensions: { labourShare: { rate: 0.4, benchmark: 0.99, coverage: 1 } },
      }),
    ).diagnostics.labourCostShare;
    const benchmark = (base + bind) / 2; // between the two corner shares → kink
    const k = ok(
      solveSteadyStateDual({ ...p, extensions: { labourShare: { rate: 0.4, benchmark, coverage: 1 } } }),
    );
    expect(k.diagnostics.regimes.labourShare).toBe('kink');
    expect(k.diagnostics.labourCostShare).toBeCloseTo(benchmark, 10);
    expect(k.government.labourShareContribution).toBeLessThan(1e-10);
  });
  it('infeasible wedges are reported, never returned as a steady state', () => {
    const p = paperParameters('B', { adoption: 0.2 });
    const r = solveSteadyStateDual({
      ...p,
      extensions: { labourShare: { rate: 1.2, benchmark: 0.99, coverage: 1 } },
    });
    expect(r.ok).toBe(false);
    expect(solveSteadyStateDual({ ...p, extensions: { valueAdded: { rate: 1, coverage: 1 } } }).ok).toBe(
      false,
    );
  });
});

describe('policy registry and required rates', () => {
  const p = paperParameters('B', { adoption: 0.3 });
  const target = baselineSsTarget(p);
  it('E, F and G rates reproduce the target exactly when solved', () => {
    for (const s of ['valueAdded', 'labourShare', 'excessProfit'] as const) {
      const r = solveRequiredRate(p, s, { ...DEFAULT_POLICY_CONFIG, labourShareBenchmark: 0.8 }, { target });
      expect(r.status, s).toBe('solved');
      if (r.status === 'solved') expect(r.steadyState.ssToGdp).toBeCloseTo(target, 10);
    }
  });
  it('a neutral excess-profit contribution cannot finance anything (unattainable)', () => {
    const r = solveRequiredRate(
      p,
      'excessProfit',
      { ...DEFAULT_POLICY_CONFIG, excessProfitAllowance: 'neutral' },
      { target },
    );
    expect(r.status).toBe('unattainable');
  });
  it('payroll replacement lowers the employer SS rate and raises the required rate', () => {
    const cfgR = { ...DEFAULT_POLICY_CONFIG, payrollReplacement: 0.5 };
    expect(withPolicy(p, 'valueAdded', 0.01, cfgR).taxes.employerSS).toBeCloseTo(
      p.taxes.employerSS * 0.5,
      15,
    );
    const sup = solveRequiredRate(p, 'valueAdded', DEFAULT_POLICY_CONFIG, { target });
    const rep = solveRequiredRate(p, 'valueAdded', cfgR, { target });
    expect(sup.status === 'solved' && rep.status === 'solved' && rep.rate > sup.rate).toBe(true);
    expect(() =>
      withPolicy(p, 'valueAdded', 0.01, { ...DEFAULT_POLICY_CONFIG, payrollReplacement: 2 }),
    ).toThrow();
  });
  it('withPolicy installs exactly one instrument', () => {
    const q = withPolicy({ ...p, taxes: { ...p.taxes, robotSS: 0.3 } }, 'valueAdded', 0.02);
    expect(q.taxes.robotSS).toBe(0);
    expect(q.extensions).toEqual({ valueAdded: { rate: 0.02, coverage: 1 } });
  });
  it('coverage after sector exemptions', () => {
    expect(coverageAfterExemptions({ I: 2321.4, J: 4637.9 }, 33742.4, ['I'])).toBeCloseTo(
      1 - 2321.4 / 33742.4,
      14,
    );
    expect(() => coverageAfterExemptions({ I: 1 }, 10, ['X'])).toThrow();
  });
});

describe('comparison table', () => {
  it('baseline row has zero changes; distortionary instruments have positive welfare cost per € raised', () => {
    const rows = comparePolicies(paperParameters('B'), 0.3);
    const base = rows[0]!;
    expect(base.status).toBe('baseline');
    expect([base.dY, base.welfareCE]).toEqual([0, 0]);
    for (const r of rows.filter((x) => x.status === 'solved')) {
      expect(r.ssToY!).toBeCloseTo(rows.find((x) => x.status === 'solved')!.ssToY!, 10);
      expect(r.costPerRevenue!).toBeGreaterThan(0);
    }
  });
});
