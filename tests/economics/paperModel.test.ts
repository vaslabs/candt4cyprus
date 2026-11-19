import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { paperParameters, PAPER_TAXES, validatePaperParameters } from '../../src/economics/paper/calibration';
import { capitalReturns } from '../../src/economics/paper/households';
import { eq33Revenue } from '../../src/economics/paper/government';
import { existenceMargin, solveSteadyStateDual } from '../../src/economics/paper/steadyState';
import {
  solveSteadyStateNewton,
  steadyStateResiduals,
  jacobianConditionAt,
} from '../../src/economics/paper/fullSystem';
import type { PaperParameters, SteadyStateLevels, SteadyStateResult } from '../../src/economics/paper/types';
import { paperParams } from '../support/paperArbitraries';
import { relErr } from '../support/arbitraries';

type Ok = Extract<SteadyStateResult, { ok: true }>;
function ok(r: SteadyStateResult): Ok {
  if (!r.ok) throw new Error(`expected a steady state, got ${r.reason}: ${r.detail}`);
  return r;
}
const LEVEL_KEYS = ['Y', 'C', 'K', 'D', 'L', 'X', 'W', 'I', 'Rk', 'Rd'] as const;
function maxRelDiff(a: SteadyStateLevels, b: SteadyStateLevels): number {
  return Math.max(...LEVEL_KEYS.map((k) => (a[k] === 0 && b[k] === 0 ? 0 : relErr(a[k], b[k]))));
}

describe('paper calibration baseline (adoption 0, no robot tax)', () => {
  it('reproduces the step-1 hand calculation (printed eq. 24, weight 0.35 on K)', () => {
    const r = ok(solveSteadyStateDual(paperParameters('A')));
    expect(r.ssToGdp).toBeCloseTo(0.1516, 4);
    expect(r.shares.grossLabour).toBeCloseTo(0.598, 3);
    expect(r.shares.grossTraditionalCapital).toBeCloseTo(0.307, 3);
    expect(r.levels.L).toBeCloseTo(0.237, 3);
    expect(r.levels.Y).toBeCloseTo(0.423, 3);
    expect(r.meta).toMatchObject({ solver: 'dual', technology: 'A', calibrationPreset: 'custom' });
    expect(r.meta.equationVariant).toEqual({ techAWeight: 'capitalWeight', labourSupply: 'asPrinted' });
  });
  it('figure-replication variant reproduces the Fig. 6 levels', () => {
    const p = paperParameters('A', {
      variant: { techAWeight: 'capitalWeight', labourSupply: 'figureReplication' },
    });
    const r = ok(solveSteadyStateDual(p));
    expect(r.levels.L).toBeCloseTo(0.332, 3);
    expect(r.levels.Y).toBeCloseTo(0.592, 3);
    expect(r.meta.equationVariant.labourSupply).toBe('figureReplication');
  });
  it('literal printed eq. (1) gives the inconsistent SS/Y ≈ 0.1015', () => {
    const p = paperParameters('A', { variant: { techAWeight: 'asPrinted', labourSupply: 'asPrinted' } });
    expect(ok(solveSteadyStateDual(p)).ssToGdp).toBeCloseTo(0.1015, 4);
  });
  it('Tech A at φ = 0 and Tech B at μ = 0 describe the same economy', () => {
    const a = ok(solveSteadyStateDual(paperParameters('A')));
    const b = ok(solveSteadyStateDual(paperParameters('B')));
    // X is excluded: it is effective labour in Tech A but the K–L bundle in Tech B.
    for (const k of ['Y', 'C', 'K', 'D', 'L', 'W', 'I', 'Rk', 'Rd'] as const) {
      expect(a.levels[k] === b.levels[k] || relErr(a.levels[k], b.levels[k]) < 1e-13).toBe(true);
    }
  });
});

describe('household Euler identities (paper p. 79–80)', () => {
  it('without taxes, R_d − δ_d = R_k − δ_k = 1/β − 1', () => {
    fc.assert(
      fc.property(paperParams(), (p0) => {
        const zero = { ...PAPER_TAXES, consumption: 0, labour: 0, employerSS: 0, employeeSS: 0, capital: 0 };
        const r = capitalReturns({ ...p0, taxes: zero });
        if (!r.ok) return false;
        const target = 1 / p0.beta - 1;
        return relErr(r.Rk - p0.deltaK, target) < 1e-12 && relErr(r.Rd - p0.deltaD, target) < 1e-12;
      }),
    );
  });
  it('eq. (31) holds when τ^d = 0 and eq. (32) when τ^id = 0', () => {
    fc.assert(
      fc.property(paperParams(), fc.double({ min: 0, max: 0.6, noNaN: true }), (p0, tau) => {
        const tk = p0.taxes.capital;
        const p31 = { ...p0, taxes: { ...p0.taxes, robotIncome: 0, robotInvestment: tau, robotSS: 0 } };
        const p32 = {
          ...p0,
          taxes: { ...p0.taxes, robotIncome: tau * (1 - tk) * 0.9, robotInvestment: 0, robotSS: 0 },
        };
        const r31 = capitalReturns(p31);
        const r32 = capitalReturns(p32);
        if (!r31.ok || !r32.ok) return false;
        const lhs31 = r31.Rk - p0.deltaK;
        const rhs31 = r31.Rd - p0.deltaD - (tau / (1 - tk)) * (1 / p0.beta - 1 + p0.deltaD);
        const td = p32.taxes.robotIncome;
        const lhs32 = r32.Rk - p0.deltaK;
        const rhs32 = (1 - td / (1 - tk)) * (r32.Rd - p0.deltaD);
        return Math.abs(lhs31 - rhs31) < 1e-13 && Math.abs(lhs32 - rhs32) < 1e-13;
      }),
    );
  });
});

describe('Solver 1 (dual) properties over random valid parameters', () => {
  it('satisfies every one of the paper’s steady-state equations (residual ≤ 1e-11)', () => {
    fc.assert(
      fc.property(paperParams(), (p) => {
        const r = ok(solveSteadyStateDual(p));
        const res = steadyStateResiduals(p, r.levels, p.adoption > 0);
        return Math.max(...res.map(Math.abs)) < 1e-11;
      }),
    );
  });
  it('zero profit (Euler), resource constraint, household budget (20) and eq. (33) hold', () => {
    fc.assert(
      fc.property(paperParams(), (p) => {
        const r = ok(solveSteadyStateDual(p));
        const d = r.diagnostics;
        const T = eq33Revenue(p, r.levels);
        return (
          Math.abs(d.eulerResidual) < 1e-12 &&
          Math.abs(d.resourceResidual) < 1e-12 &&
          Math.abs(d.householdBudgetResidual) < 1e-11 &&
          relErr(T, r.government.total) < 1e-12
        );
      }),
    );
  });
  it('quantities are economically feasible: Y, C, K, X, W > 0, D ≥ 0, 0 < L < 1', () => {
    fc.assert(
      fc.property(paperParams(), (p) => {
        const { Y, C, K, D, L, X, W } = ok(solveSteadyStateDual(p)).levels;
        return (
          Y > 0 &&
          C > 0 &&
          K > 0 &&
          X > 0 &&
          W > 0 &&
          D >= 0 &&
          L > 0 &&
          L < 1 &&
          (p.adoption > 0 ? D > 0 : D === 0)
        );
      }),
    );
  });
  it('net and gross factor shares each sum to one (including employer contributions)', () => {
    fc.assert(
      fc.property(paperParams(), (p) => {
        const s = ok(solveSteadyStateDual(p)).shares;
        const net = s.netLabour + s.netTraditionalCapital + s.netAutonomousCapital;
        const gross =
          s.grossLabour +
          s.employerSSLabour +
          s.grossTraditionalCapital +
          s.grossAutonomousCapital +
          s.employerSSRobot;
        return Math.abs(net - 1) < 1e-12 && Math.abs(gross - 1) < 1e-12;
      }),
    );
  });
  it('with no robot tax, all SS comes from labour', () => {
    fc.assert(
      fc.property(paperParams(), (p0) => {
        const p = { ...p0, taxes: { ...p0.taxes, robotIncome: 0, robotInvestment: 0, robotSS: 0 } };
        // Removing robot taxes makes robots cheaper and can move the existence boundary below p.adoption.
        const r = solveSteadyStateDual(p);
        fc.pre(r.ok);
        const g = ok(r).government;
        return g.ssRobot === 0 && g.ssTotal === g.ssLabour;
      }),
    );
  });
});

describe('γ-invariance and labour-supply-variant invariance (MODEL_SPEC §5, Proposition 1)', () => {
  const ratios = (r: Ok) => [
    r.ssToGdp,
    r.government.ssLabour / r.levels.Y,
    r.government.ssRobot / r.levels.Y,
    r.levels.K / r.levels.Y,
    r.levels.D / r.levels.Y,
    r.levels.C / r.levels.Y,
    r.levels.W,
    r.levels.Rk,
    r.levels.Rd,
    r.shares.grossLabour,
    r.shares.netLabour,
    r.shares.grossAutonomousCapital,
  ];
  it('all per-unit-of-output quantities are independent of γ and of the eq. (24) variant', () => {
    fc.assert(
      fc.property(paperParams(), fc.double({ min: 0.05, max: 0.95, noNaN: true }), (p, g2) => {
        const base = ok(solveSteadyStateDual(p));
        const otherGamma = ok(solveSteadyStateDual({ ...p, gamma: g2 }));
        const otherVariant = ok(
          solveSteadyStateDual({
            ...p,
            variant: {
              ...p.variant,
              labourSupply: p.variant.labourSupply === 'asPrinted' ? 'figureReplication' : 'asPrinted',
            },
          }),
        );
        const r0 = ratios(base);
        return [otherGamma, otherVariant].every((o) => ratios(o).every((v, i) => relErr(v, r0[i]!) < 1e-12));
      }),
    );
  });
  it('…whereas levels do depend on γ (the invariance is not vacuous)', () => {
    const a = ok(solveSteadyStateDual(paperParameters('A', { adoption: 0.2 })));
    const b = ok(solveSteadyStateDual(paperParameters('A', { adoption: 0.2, gamma: 0.5 })));
    expect(relErr(a.levels.L, b.levels.L)).toBeGreaterThan(0.1);
  });
});

describe('Solver 2 (full 10-equation Newton) vs Solver 1 (dual): differential test', () => {
  it('agree on every level to 1e-9 relative, and Newton reports convergence', () => {
    fc.assert(
      fc.property(paperParams(0.9), (p) => {
        const d = ok(solveSteadyStateDual(p));
        const n = ok(solveSteadyStateNewton(p, { calibrationPreset: 'test' }));
        return (
          maxRelDiff(d.levels, n.levels) < 1e-9 &&
          n.meta.convergence.status === 'converged' &&
          n.meta.convergence.residualNorm <= 1e-12 &&
          n.meta.solver === 'newton' &&
          n.meta.calibrationPreset === 'test'
        );
      }),
      { numRuns: 60 },
    );
  });
  it('is insensitive to the initial guess (multi-start without continuation)', () => {
    fc.assert(
      fc.property(
        paperParams(0.8),
        fc.array(fc.double({ min: -0.5, max: 0.5, noNaN: true }), { minLength: 10, maxLength: 10 }),
        (p, logPerturb) => {
          const d = ok(solveSteadyStateDual(p));
          fc.pre(p.adoption > 0.01);
          const guess = Object.fromEntries(
            (['Y', 'C', 'K', 'D', 'L', 'X', 'W', 'I', 'Rk', 'Rd'] as const).map((k, i) => [
              k,
              d.levels[k] * Math.exp(logPerturb[i]!) * (k === 'L' ? 0.5 : 1), // keep L < 1
            ]),
          ) as Record<(typeof LEVEL_KEYS)[number], number>;
          const n = solveSteadyStateNewton(p, { initialGuess: guess, continuation: false });
          // Either it converges to the same point, or it reports failure; never a different "solution".
          return !n.ok || maxRelDiff(d.levels, n.levels) < 1e-9;
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe('existence boundary: genuine non-existence vs numerical failure', () => {
  it('Tech B, σ = 2, ε ≤ 1 (paper’s domain): boundary is exactly μ* = √((1+τ^ssz)R_d)', () => {
    // With ε > 1 the inner K–L stage binds first (K prices L out as the bundle cost → ∞), so the
    // closed form is only claimed under the paper's assumption 0 < ε < 1 < σ.
    fc.assert(
      fc.property(paperParams(), fc.double({ min: 0.3, max: 1, noNaN: true }), (p0, eps) => {
        const p = { ...p0, technology: 'B' as const, elasticityAuto: 2, elasticityKL: eps };
        const r = capitalReturns(p);
        if (!r.ok) return false;
        const muStar = Math.sqrt((1 + p.taxes.robotSS) * r.Rd);
        fc.pre(muStar < 0.99 && existenceMargin({ ...p, adoption: 0 }) > 1e-6);
        const below = solveSteadyStateDual({ ...p, adoption: muStar * (1 - 1e-6) });
        const above = solveSteadyStateDual({ ...p, adoption: muStar * (1 + 1e-6) });
        return below.ok && !above.ok && above.reason === 'robots-dominate';
      }),
    );
  });
  it('paper calibration: Tech A φ* ≈ 0.4348 and Tech B μ* ≈ 0.4835 (Fig. 1 curves end there)', async () => {
    const { existenceBoundary } = await import('../../src/economics/paper/existence');
    const a = existenceBoundary(paperParameters('A'));
    const b = existenceBoundary(paperParameters('B'));
    expect(a.kind === 'boundary' && a.adoption).toBeCloseTo(0.43484, 5);
    expect(b.kind === 'boundary' && b.adoption).toBeCloseTo(0.48355, 5);
  });
  it('margin is continuous across the boundary (no jump that a solver could mistake)', async () => {
    const { existenceBoundary } = await import('../../src/economics/paper/existence');
    for (const tech of ['A', 'B'] as const) {
      const b = existenceBoundary(paperParameters(tech));
      if (b.kind !== 'boundary') throw new Error('expected boundary');
      const m = (a: number) => existenceMargin(paperParameters(tech, { adoption: a }));
      expect(Math.abs(m(b.adoption - 1e-7))).toBeLessThan(1e-5);
      expect(Math.abs(m(b.adoption + 1e-7))).toBeLessThan(1e-5);
    }
  });
  it('Newton never "converges" beyond the boundary, and reports solver failure (not non-existence)', () => {
    for (const tech of ['A', 'B'] as const) {
      const star = tech === 'A' ? 0.43484 : 0.48355;
      const n = solveSteadyStateNewton(paperParameters(tech, { adoption: star + 0.005 }));
      expect(n.ok).toBe(false);
      if (!n.ok) expect(n.reason).toBe('solver-failed');
      const d = solveSteadyStateDual(paperParameters(tech, { adoption: star + 0.005 }));
      expect(!d.ok && d.reason).toBe('robots-dominate');
    }
  });
  it('approaching the boundary: labour cost share → 0, output explodes, Jacobian conditioning worsens', () => {
    const p = (a: number) => paperParameters('A', { adoption: a });
    const far = ok(solveSteadyStateDual(p(0.3)));
    const near = ok(solveSteadyStateDual(p(0.4348)));
    expect(near.diagnostics.labourCostShare).toBeLessThan(far.diagnostics.labourCostShare / 10);
    expect(near.levels.Y).toBeGreaterThan(10 * far.levels.Y);
    expect(jacobianConditionAt(p(0.4348), near.levels)).toBeGreaterThan(
      jacobianConditionAt(p(0.3), far.levels),
    );
  });
});

describe('non-existence without automation is reported, not hidden', () => {
  it('K-weight 0.8 with ρ > 1 (literal eq. 1 variant) is AK in traditional capital', () => {
    const p = paperParameters('A', {
      capitalShareParam: 0.2,
      elasticityKL: 1.5,
      variant: { techAWeight: 'asPrinted', labourSupply: 'asPrinted' },
    });
    const r = solveSteadyStateDual(p);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('stage-infeasible');
      expect(r.meta.convergence.status).toBe('no-steady-state');
    }
  });
});

describe('parameter validation', () => {
  it('accepts the paper preset and rejects invalid inputs', () => {
    expect(() => validatePaperParameters(paperParameters('A'))).not.toThrow();
    const bad = (o: Partial<PaperParameters>) => () =>
      validatePaperParameters({ ...paperParameters('A'), ...o });
    expect(bad({ beta: 1.2 })).toThrow();
    expect(bad({ adoption: 1 })).toThrow();
    expect(bad({ adoption: 1e-12 })).toThrow();
    expect(() => validatePaperParameters({ ...paperParameters('A'), adoption: 0 })).not.toThrow();
    expect(bad({ elasticityAuto: 0 })).toThrow();
    expect(bad({ taxes: { ...PAPER_TAXES, capital: 0.6, robotIncome: 0.5 } })).toThrow();
  });
});
