import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { paperParameters, PAPER_TAXES } from '../../src/economics/paper/calibration';
import { solveSteadyStateDual } from '../../src/economics/paper/steadyState';
import {
  baselineSsTarget,
  rateUpperBound,
  ROBOT_TAX_SCHEMES,
  SCHEME_INFO,
  solveRequiredRobotTax,
  sweepAdoption,
  withRobotTax,
} from '../../src/economics/policies/robotTaxes';
import { techAClosedFormRates } from '../../src/economics/policies/closedForms';
import { paperParams } from '../support/paperArbitraries';
import { relErr } from '../support/arbitraries';

const scheme = fc.constantFrom(...ROBOT_TAX_SCHEMES);
/** Random valid parameters with no robot tax preset, positive adoption and non-trivial SS rates. */
const untaxed = paperParams(0.9)
  .map((p) => withRobotTax(p, 'none', 0))
  .filter((p) => p.adoption > 0.01 && p.taxes.employerSS + p.taxes.employeeSS > 0.01);

describe('scheme metadata shown to users', () => {
  it('states the distinct tax base of each scheme exactly as in eq. (33)', () => {
    expect(SCHEME_INFO.robotIncome).toMatchObject({ symbol: 'τ^d', base: '(R_d − δ_d)·D' });
    expect(SCHEME_INFO.robotInvestment).toMatchObject({ symbol: 'τ^id', base: 'I_d' });
    expect(SCHEME_INFO.robotSS).toMatchObject({ symbol: 'τ^ssz', base: 'R_d·D' });
    expect(SCHEME_INFO.none.base).toBe('—');
    expect(new Set(Object.values(SCHEME_INFO).map((i) => i.label)).size).toBe(4);
    expect(SCHEME_INFO.robotSS.label).toMatch(/social-security/i);
    expect(SCHEME_INFO.robotInvestment.label).toMatch(/investment/i);
    expect(SCHEME_INFO.robotIncome.label).toMatch(/income/i);
  });
});

describe('withRobotTax', () => {
  it('sets exactly one robot tax and leaves other taxes untouched', () => {
    const p = paperParameters('A', { taxes: { ...PAPER_TAXES, robotIncome: 0.1, robotSS: 0.2 } });
    for (const s of ROBOT_TAX_SCHEMES) {
      const q = withRobotTax(p, s, 0.33);
      const robot = [q.taxes.robotIncome, q.taxes.robotInvestment, q.taxes.robotSS];
      expect(robot.filter((v) => v !== 0)).toEqual([0.33]);
      expect(q.taxes[s]).toBe(0.33);
      expect(q.taxes.capital).toBe(PAPER_TAXES.capital);
    }
    expect(withRobotTax(p, 'none', 0.5).taxes).toMatchObject({
      robotIncome: 0,
      robotInvestment: 0,
      robotSS: 0,
    });
    expect(rateUpperBound(p, 'robotIncome')).toBeLessThan(1 - PAPER_TAXES.capital);
  });
});

describe('endogenous robot tax', () => {
  it('no tax is needed at zero adoption (target = baseline)', () => {
    for (const s of ROBOT_TAX_SCHEMES) {
      expect(solveRequiredRobotTax(paperParameters('A'), s).status).toBe('not-needed');
    }
  });

  it('a solved rate reproduces the target SS/Y exactly and no smaller rate does (fine-grid check)', () => {
    fc.assert(
      fc.property(untaxed, scheme, (p, s) => {
        const r = solveRequiredRobotTax(p, s, { scanIntervals: 200 });
        if (r.status !== 'solved') return true; // unattainable/no SS are checked separately
        const again = solveSteadyStateDual(withRobotTax(p, s, r.rate));
        if (!again.ok || Math.abs(again.ssToGdp - r.target) > 1e-10) return false;
        // Independent finer grid on [0, 0.99·rate]: among points with a steady state, the gap
        // must not change sign (otherwise a smaller root was missed).
        const signs = new Set<number>();
        for (let i = 0; i <= 1000; i++) {
          const tau = (0.99 * r.rate * i) / 1000;
          const q = solveSteadyStateDual(withRobotTax(p, s, tau));
          if (q.ok) signs.add(Math.sign(q.ssToGdp - r.target));
        }
        return signs.size <= 1 && r.additionalRoots.every((x) => x > r.rate);
      }),
      { numRuns: 60 },
    );
  });

  it('flags when a robot tax is needed for a steady state to exist at all', () => {
    const p = paperParameters('A', { adoption: 0.44 }); // beyond the untaxed boundary φ* = 0.4348
    const r = solveRequiredRobotTax(p, 'robotSS');
    expect(r.status).toBe('solved');
    if (r.status === 'solved') expect(r.untaxedSteadyStateExists).toBe(false);
    const q = solveRequiredRobotTax(paperParameters('A', { adoption: 0.3 }), 'robotSS');
    expect(q.status === 'solved' && q.untaxedSteadyStateExists).toBe(true);
  });

  it('“unattainable” is genuine: no scanned rate with a steady state reaches the target', () => {
    const p = paperParameters('B', { adoption: 0.02, elasticityAuto: 2 });
    const r = solveRequiredRobotTax(p, 'robotIncome');
    expect(r.status).toBe('unattainable');
    if (r.status === 'unattainable') {
      expect(r.maxSsToGdp).toBeLessThan(r.target);
      for (let i = 0; i <= 50; i++) {
        const tau = (rateUpperBound(p, 'robotIncome') * i) / 50;
        const s = solveSteadyStateDual(withRobotTax(p, 'robotIncome', tau));
        if (s.ok) expect(s.ssToGdp).toBeLessThanOrEqual(r.maxSsToGdp + 1e-12);
      }
    }
  });

  it('Proposition 3: under Tech A the required rates equal the closed forms for any adoption/elasticity', () => {
    fc.assert(
      fc.property(untaxed, scheme, (p0, s) => {
        const p = { ...p0, technology: 'A' as const };
        const closed = techAClosedFormRates(p)[s];
        // Proposition 3's condition: a steady state exists at the closed-form rate.
        fc.pre(solveSteadyStateDual(p).ok && solveSteadyStateDual(withRobotTax(p, s, closed)).ok);
        const r = solveRequiredRobotTax(p, s, { scanIntervals: 200 });
        fc.pre(r.status === 'solved');
        return relErr((r as { rate: number }).rate, closed) < 1e-9;
      }),
      { numRuns: 100 },
    );
  });

  it('paper calibration closed forms: 0.5588 / 0.3789 / 0.2798', () => {
    const c = techAClosedFormRates(paperParameters('A'));
    expect(c.robotIncome).toBeCloseTo(0.5588, 4);
    expect(c.robotInvestment).toBeCloseTo(0.3789, 4);
    expect(c.robotSS).toBeCloseTo(0.2798, 4);
  });

  it('Proposition 1 corollary: required rates do not depend on γ or the eq. (24) variant', () => {
    fc.assert(
      fc.property(untaxed, scheme, fc.double({ min: 0.1, max: 0.9, noNaN: true }), (p, s, g) => {
        const a = solveRequiredRobotTax(p, s, { scanIntervals: 100 });
        const b = solveRequiredRobotTax(
          { ...p, gamma: g, variant: { ...p.variant, labourSupply: 'figureReplication' } },
          s,
          { scanIntervals: 100 },
        );
        if (a.status !== b.status) return false;
        // Same function up to rounding; Brent's root can move by its tolerance where the gap is flat.
        return a.status !== 'solved' || Math.abs(a.rate - (b as { rate: number }).rate) < 1e-9;
      }),
      { numRuns: 60 },
    );
  });

  it('target is adjustable: a higher target needs a higher rate', () => {
    const p = paperParameters('B', { adoption: 0.3 });
    const t0 = baselineSsTarget(p);
    const lo = solveRequiredRobotTax(p, 'robotSS', { target: t0 });
    const hi = solveRequiredRobotTax(p, 'robotSS', { target: t0 + 0.01 });
    if (lo.status !== 'solved' || hi.status !== 'solved') throw new Error('expected solutions');
    expect(hi.rate).toBeGreaterThan(lo.rate);
    expect(hi.target).toBeCloseTo(t0 + 0.01, 15);
  });
});

describe('adoption sweep', () => {
  it('records status for every point and labour + robot SS shares sum to one', () => {
    const sw = sweepAdoption(paperParameters('B'), 'robotSS', [0, 0.02, 0.2, 0.45, 0.6]);
    expect(sw.map((s) => s.status)).toEqual(['not-needed', 'solved', 'solved', 'solved', 'unattainable']);
    for (const s of sw.filter((x) => x.result?.ok)) {
      expect(s.labourSourceShare! + s.robotSourceShare!).toBeCloseTo(1, 14);
    }
    const none = sweepAdoption(paperParameters('A'), 'none', [0.2, 0.44]);
    expect(none[0]!.status).toBe('baseline');
    expect(none[1]!.result?.ok).toBe(false); // beyond φ* = 0.4348: reported, not interpolated
  });
});
