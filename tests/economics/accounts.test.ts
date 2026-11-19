/**
 * Deterministic, hand-computed checks of tax bases and SS aggregation (targeted at mutants that
 * random properties exercise weakly). Each robot tax is checked against its eq. (33) base.
 */
import { describe, expect, it } from 'vitest';
import { paperParameters, PAPER_TAXES, validatePaperParameters } from '../../src/economics/paper/calibration';
import { capitalReturns } from '../../src/economics/paper/households';
import {
  eq33Revenue,
  factorShares,
  governmentAccounts,
  householdBudgetResidual,
} from '../../src/economics/paper/government';
import { existenceBoundary } from '../../src/economics/paper/existence';
import { existenceMargin, solveSteadyStateDual } from '../../src/economics/paper/steadyState';
import { solveSteadyStateNewton } from '../../src/economics/paper/fullSystem';
import type { SteadyStateLevels, TaxRates } from '../../src/economics/paper/types';

// A synthetic (not equilibrium) level vector with distinct values so every term is identifiable.
const S: SteadyStateLevels = {
  Y: 10,
  C: 6,
  K: 20,
  D: 5,
  L: 0.3,
  X: 4,
  W: 7,
  I: 2.2,
  Rk: 0.12,
  Rd: 0.3,
  Ik: 1.2,
  Id: 1,
};
const withTax = (t: Partial<TaxRates>) =>
  paperParameters('A', { taxes: { ...PAPER_TAXES, ...t }, deltaK: 0.06, deltaD: 0.2 });

describe('robot tax bases (eq. 33) and SS aggregation (D5)', () => {
  it('scheme 1: τ^d (R_d − δ_d) D', () => {
    const g = governmentAccounts(withTax({ robotIncome: 0.3 }), S);
    expect(g.robotIncomeTax).toBeCloseTo(0.3 * (0.3 - 0.2) * 5, 14);
    expect(g.ssRobot).toBeCloseTo(0.15, 14);
  });
  it('scheme 2: τ^id I_d', () => {
    const g = governmentAccounts(withTax({ robotInvestment: 0.25 }), S);
    expect(g.robotInvestmentTax).toBeCloseTo(0.25 * 1, 14);
    expect(g.ssRobot).toBeCloseTo(0.25, 14);
  });
  it('scheme 3: τ^ssz R_d D', () => {
    const g = governmentAccounts(withTax({ robotSS: 0.2 }), S);
    expect(g.robotSS).toBeCloseTo(0.2 * 0.3 * 5, 14);
    expect(g.ssRobot).toBeCloseTo(0.3, 14);
  });
  it('SS total = (τ^sse + τ^ssw) W L + robot revenue; all three robot taxes add up if set together', () => {
    const g = governmentAccounts(withTax({ robotIncome: 0.3, robotInvestment: 0.25, robotSS: 0.2 }), S);
    const labour = (0.1589 + 0.0945) * 7 * 0.3;
    expect(g.ssLabour).toBeCloseTo(labour, 14);
    expect(g.ssRobot).toBeCloseTo(0.15 + 0.25 + 0.3, 14);
    expect(g.ssTotal).toBeCloseTo(labour + 0.7, 14);
  });
  it('itemised total equals eq. (33) written literally, for every tax switched on', () => {
    const p = withTax({ robotIncome: 0.3, robotInvestment: 0.25, robotSS: 0.2 });
    const g = governmentAccounts(p, S);
    const t = p.taxes;
    const byHand =
      t.consumption * 6 +
      (t.labour + t.employeeSS + t.employerSS) * 7 * 0.3 +
      t.capital * (0.12 - 0.06) * 20 +
      (t.capital + 0.3 + 0.2) * 0.3 * 5 -
      (t.capital + 0.3) * 0.2 * 5 +
      0.25 * 1;
    expect(g.total).toBeCloseTo(byHand, 13);
    expect(eq33Revenue(p, S)).toBeCloseTo(byHand, 13);
  });
  it('employer robot SS share and net autonomous share include (1+τ^ssz)', () => {
    const s = factorShares(withTax({ robotSS: 0.2 }), S);
    expect(s.employerSSRobot).toBeCloseTo((0.2 * 0.3 * 5) / 10, 14);
    expect(s.netAutonomousCapital).toBeCloseTo((1.2 * 0.3 * 5 - 0.2 * 5) / (10 - 0.06 * 20 - 0.2 * 5), 14);
  });
  it('household budget residual uses (1+τ^id) I_d and (1−τ^k−τ^d) R_d D', () => {
    const p = withTax({ robotIncome: 0.3, robotInvestment: 0.25 });
    const t = p.taxes;
    const lhs = (1 + t.consumption) * 6 + 1.2 + 1.25 * 1;
    const rhs =
      (1 - t.labour - t.employeeSS) * 7 * 0.3 +
      (1 - t.capital) * 0.12 * 20 +
      (1 - t.capital - 0.3) * 0.3 * 5 +
      t.capital * 0.06 * 20 +
      (t.capital + 0.3) * 0.2 * 5 +
      4;
    expect(householdBudgetResidual(p, S, 4)).toBeCloseTo((lhs - rhs) / 10, 14);
  });
});

describe('robot SS contribution enters the robot FOC and the existence margin as (1+τ^ssz)R_d', () => {
  it('Newton and dual agree with τ^ssz = 0.2 (Tech A and B)', () => {
    for (const tech of ['A', 'B'] as const) {
      const p = paperParameters(tech, { adoption: 0.3, taxes: { ...PAPER_TAXES, robotSS: 0.2 } });
      const d = solveSteadyStateDual(p);
      const n = solveSteadyStateNewton(p);
      if (!d.ok || !n.ok) throw new Error('expected solutions');
      expect(Math.abs(n.levels.D / d.levels.D - 1)).toBeLessThan(1e-9);
      expect(d.diagnostics.eulerResidual).toBeCloseTo(0, 13);
    }
  });
  it('Tech B boundary moves to √(1.2·R_d) with τ^ssz = 0.2', () => {
    const p = paperParameters('B', { taxes: { ...PAPER_TAXES, robotSS: 0.2 } });
    const r = capitalReturns(p);
    const b = existenceBoundary(p);
    if (!r.ok || b.kind !== 'boundary') throw new Error('expected boundary');
    expect(b.adoption).toBeCloseTo(Math.sqrt(1.2 * r.Rd), 12);
  });
  it('existence margin reports a valid outcome for every kind of input', () => {
    expect(existenceMargin(paperParameters('A', { taxes: { ...PAPER_TAXES, capital: 1 } }))).toBe(-Infinity);
    expect(existenceMargin(paperParameters('A'))).toBeGreaterThan(0);
    expect(existenceMargin(paperParameters('A', { adoption: 0.5 }))).toBeLessThan(0);
  });
  it('existenceBoundary classifies "infeasible at start" and "none in range"', () => {
    const bad = paperParameters('A', {
      capitalShareParam: 0.2,
      elasticityKL: 1.5,
      variant: { techAWeight: 'asPrinted', labourSupply: 'asPrinted' },
    });
    expect(existenceBoundary(bad).kind).toBe('infeasible-at-start');
    expect(existenceBoundary(paperParameters('A', { elasticityAuto: 1 })).kind).toBe('none-in-range');
  });
});

describe('household guards return explicit failures', () => {
  it('rejects τ^k ≥ 1, τ^k + τ^d ≥ 1 and non-positive rental rates', () => {
    expect(capitalReturns(withTax({ capital: 1 })).ok).toBe(false);
    expect(capitalReturns(withTax({ capital: 0.5, robotIncome: 0.5 })).ok).toBe(false);
    expect(capitalReturns(withTax({ capital: 0.5, robotIncome: 0.49 })).ok).toBe(true);
    const r = solveSteadyStateDual(withTax({ capital: 0.6, robotIncome: 0.4 }));
    expect(!r.ok && r.reason).toBe('invalid-capital-returns');
    if (!r.ok) expect(r.meta.convergence.status).toBe('no-steady-state');
  });
});

describe('schema edges', () => {
  const v = (o: object) => () => validatePaperParameters({ ...paperParameters('A'), ...o });
  it('accepts boundary-valid and rejects boundary-invalid values', () => {
    expect(v({ adoption: 1e-9 })).not.toThrow();
    expect(v({ taxes: { ...PAPER_TAXES, labour: 0.5, employeeSS: 0.5 } })).toThrow();
    expect(v({ taxes: { ...PAPER_TAXES, labour: 0.5, employeeSS: 0.49 } })).not.toThrow();
    expect(v({ taxes: { ...PAPER_TAXES, capital: 0.5, robotIncome: 0.5 } })).toThrow();
    expect(v({ taxes: { ...PAPER_TAXES, robotInvestment: 5, robotSS: 5 } })).not.toThrow();
    expect(v({ taxes: { ...PAPER_TAXES, robotSS: -0.1 } })).toThrow();
    expect(v({ beta: 0 })).toThrow();
    expect(v({ gamma: 1 })).toThrow();
    expect(v({ technology: 'C' })).toThrow();
    expect(v({ variant: { techAWeight: 'other', labourSupply: 'asPrinted' } })).toThrow();
  });
});
