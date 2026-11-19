/**
 * Statutory accounting tests. They use an explicit fixture of 2026 rules (TEST_RULES) so the
 * arithmetic is tested independently of the data file; the data file itself is tested in
 * cyprusDefaults.test.ts.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  employeeContributions,
  selfEmployedContributions,
  total,
} from '../../src/economics/cyprus/contributionRules';
import { incomeTax, marginalRate, progressiveTax, validateBands } from '../../src/economics/cyprus/incomeTax';
import { employeeResult, payroll, salarySchedule } from '../../src/economics/cyprus/employerCosts';
import type { CyprusStatutoryRules } from '../../src/economics/cyprus/types';

export const TEST_RULES: CyprusStatutoryRules = {
  year: 2026,
  socialInsurance: {
    employeeRate: 0.088,
    employerRate: 0.088,
    stateRate: 0.052,
    selfEmployedRate: 0.166,
    stateRateSelfEmployed: 0.052,
    ceilingPerPeriod: { monthly: 5742, weekly: 1325 },
    annualCeiling: 68904,
  },
  ghs: {
    employeeRate: 0.0265,
    employerRate: 0.029,
    stateRate: 0.047,
    selfEmployedRate: 0.04,
    annualCeiling: 180000,
  },
  employerFunds: {
    socialCohesion: { rate: 0.02, base: 'none', recipient: 'socialCohesionFund' },
    redundancy: { rate: 0.012, base: 'siCeiling', recipient: 'redundancyFund' },
    hrd: { rate: 0.005, base: 'siCeiling', recipient: 'hrdAuthority' },
    centralHoliday: { rate: 0.08, base: 'siCeiling', recipient: 'centralHolidayFund' },
    hrdSelfEmployedRate: 0.005,
  },
  incomeTax: {
    bands: [
      { from: 0, to: 22000, rate: 0 },
      { from: 22000, to: 32000, rate: 0.2 },
      { from: 32000, to: 42000, rate: 0.25 },
      { from: 42000, to: 72000, rate: 0.3 },
      { from: 72000, to: null, rate: 0.35 },
    ],
    contributionDeductionCapShare: null,
  },
  corporateTaxRate: 0.15,
  vatStandardRate: 0.19,
};
const R = TEST_RULES;
const salary = fc.double({ min: 0, max: 500000, noNaN: true });
const monthly = (m: number, n = 12) => ({
  periodType: 'monthly' as const,
  periodEarnings: Array.from({ length: n }, () => m),
});

describe('income tax (progressive schedule, 2026 bands)', () => {
  it('hand-computed values at and between band edges', () => {
    const b = R.incomeTax.bands;
    expect(progressiveTax(0, b)).toBe(0);
    expect(progressiveTax(22000, b)).toBe(0);
    expect(progressiveTax(32000, b)).toBeCloseTo(2000, 10);
    expect(progressiveTax(42000, b)).toBeCloseTo(4500, 10);
    expect(progressiveTax(72000, b)).toBeCloseTo(13500, 10);
    expect(progressiveTax(100000, b)).toBeCloseTo(13500 + 0.35 * 28000, 10);
    expect(progressiveTax(-5, b)).toBe(0);
  });
  it('is not a flat rate: average rate < marginal rate above the first band', () => {
    expect(progressiveTax(50000, R.incomeTax.bands) / 50000).toBeLessThan(
      marginalRate(50000, R.incomeTax.bands),
    );
  });
  it('is continuous, non-decreasing, with slope equal to the marginal band rate', () => {
    fc.assert(
      fc.property(salary, fc.double({ min: 0.01, max: 100, noNaN: true }), (y, h) => {
        const b = R.incomeTax.bands;
        const t0 = progressiveTax(y, b);
        const t1 = progressiveTax(y + h, b);
        const crossesEdge = b.some((x) => x.from > y && x.from < y + h);
        return (
          t1 >= t0 &&
          (crossesEdge || Math.abs((t1 - t0) / h - marginalRate(y, b)) < 1e-7) &&
          t1 - t0 <= 0.35 * h + 1e-9
        );
      }),
    );
  });
  it('average rate is non-decreasing and below the top rate', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1e6, noNaN: true }),
        fc.double({ min: 1, max: 1e6, noNaN: true }),
        (a, c) => {
          const [lo, hi] = a < c ? [a, c] : [c, a];
          const b = R.incomeTax.bands;
          return (
            progressiveTax(lo, b) / lo <= progressiveTax(hi, b) / hi + 1e-12 &&
            progressiveTax(hi, b) / hi < 0.35
          );
        },
      ),
    );
  });
  it('band validation rejects gaps, overlaps and closed top bands', () => {
    expect(() => validateBands(R.incomeTax.bands)).not.toThrow();
    expect(() =>
      validateBands([
        { from: 0, to: 10, rate: 0 },
        { from: 11, to: null, rate: 0.2 },
      ]),
    ).toThrow();
    expect(() =>
      validateBands([
        { from: 0, to: 10, rate: 0 },
        { from: 10, to: 20, rate: 0.2 },
      ]),
    ).toThrow();
    expect(() => validateBands([{ from: 5, to: null, rate: 0 }])).toThrow();
    expect(() => validateBands([])).toThrow();
  });
  it('taxes taxable income after deductions; an unverified deduction cap is flagged, not guessed', () => {
    const r = incomeTax(
      { grossEmploymentIncome: 40000, employeeContributions: 4580, otherDeductions: 1000 },
      R.incomeTax,
    );
    expect(r.contributionDeductionUnverified).toBe(true);
    expect(r.taxableIncome).toBe(39000);
    const withCap = incomeTax(
      { grossEmploymentIncome: 40000, employeeContributions: 4580 },
      { ...R.incomeTax, contributionDeductionCapShare: 0.1 },
    );
    expect(withCap.contributionDeduction).toBe(4000); // capped at 10% of gross
    expect(withCap.taxableIncome).toBe(36000);
  });
});

describe('Social Insurance contributions', () => {
  it('below the ceiling: 8.8% + 8.8% + 5.2% of earnings', () => {
    const c = employeeContributions(monthly(2000), R);
    expect(c.siInsurableAnnual).toBe(24000);
    expect(total(c.lines, { item: 'si', payer: 'employee' })).toBeCloseTo(2112, 8);
    expect(total(c.lines, { item: 'si', payer: 'employer' })).toBeCloseTo(2112, 8);
    expect(total(c.lines, { item: 'si', payer: 'state' })).toBeCloseTo(1248, 8);
  });
  it('the per-period ceiling caps insurable earnings at €5,742/month (= €68,904/year)', () => {
    const c = employeeContributions(monthly(10000), R);
    expect(c.siInsurableAnnual).toBe(68904);
    expect(total(c.lines, { item: 'si', payer: 'employee' })).toBeCloseTo(0.088 * 68904, 8);
  });
  it('applies the ceiling per period: uneven pay can be capped even when the annual total is below €68,904', () => {
    const lumpy = { periodType: 'monthly' as const, periodEarnings: [...Array(11).fill(2000), 30000] }; // 52,000/yr
    const c = employeeContributions(lumpy, R);
    expect(c.grossAnnual).toBe(52000);
    expect(c.siInsurableAnnual).toBe(11 * 2000 + 5742);
  });
  it('contributions are monotone in earnings, linear below the ceiling, flat above it', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 20000, noNaN: true }),
        fc.double({ min: 0, max: 20000, noNaN: true }),
        (a, b) => {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          const s = (m: number) =>
            total(employeeContributions(monthly(m), R).lines, { item: 'si', payer: 'employee' });
          const linear = hi <= 5742 ? Math.abs(s(hi) - 0.088 * 12 * hi) < 1e-6 : true;
          const flat = lo >= 5742 ? Math.abs(s(hi) - s(lo)) < 1e-9 : true;
          return s(lo) <= s(hi) + 1e-9 && linear && flat;
        },
      ),
    );
  });
  it('employee + employer + state SI are separate lines and all go to the Social Insurance Fund', () => {
    const c = employeeContributions(monthly(3000), R);
    const si = c.lines.filter((l) => l.item === 'si');
    expect(si.map((l) => l.payer).sort()).toEqual(['employee', 'employer', 'state']);
    expect(si.every((l) => l.recipient === 'socialInsuranceFund')).toBe(true);
    expect(c.lines.filter((l) => l.recipient === 'socialInsuranceFund').every((l) => l.item === 'si')).toBe(
      true,
    );
  });
  it('zero earnings give zero contributions', () => {
    const c = employeeContributions(monthly(0), R);
    expect(c.lines.every((l) => l.amount === 0)).toBe(true);
  });
  it('rejects negative or non-finite earnings and unknown period ceilings', () => {
    expect(() => employeeContributions(monthly(-1), R)).toThrow();
    expect(() => employeeContributions(monthly(NaN), R)).toThrow();
    const noWeekly = {
      ...R,
      socialInsurance: { ...R.socialInsurance, ceilingPerPeriod: { monthly: 5742, weekly: null } },
    };
    expect(() => employeeContributions({ periodType: 'weekly', periodEarnings: [500] }, noWeekly)).toThrow();
  });
  it('self-employed: 16.6% (+ state) and the new 0.5% HRD levy, capped at 52 × weekly ceiling', () => {
    const c = selfEmployedContributions(100000, R);
    expect(c.siInsurableAnnual).toBe(52 * 1325);
    expect(total(c.lines, { item: 'si', payer: 'selfEmployed' })).toBeCloseTo(0.166 * 68900, 8);
    expect(total(c.lines, { item: 'si', payer: 'state' })).toBeCloseTo(0.052 * 68900, 8);
    expect(total(c.lines, { item: 'hrd', payer: 'selfEmployed' })).toBeCloseTo(0.005 * 68900, 8);
    expect(total(c.lines, { item: 'ghs', payer: 'selfEmployed' })).toBeCloseTo(0.04 * 100000, 8);
  });
});

describe('GHS and other employer funds are separate from the Social Insurance Fund', () => {
  it('GHS uses its own €180,000 ceiling and recipient', () => {
    const c = employeeContributions(monthly(20000), R); // 240,000/yr
    expect(c.ghsBaseAnnual).toBe(180000);
    expect(total(c.lines, { item: 'ghs', payer: 'employee' })).toBeCloseTo(0.0265 * 180000, 8);
    expect(total(c.lines, { item: 'ghs', payer: 'employer' })).toBeCloseTo(0.029 * 180000, 8);
    expect(
      c.lines.filter((l) => l.item === 'ghs').every((l) => l.recipient === 'healthInsuranceOrganisation'),
    ).toBe(true);
  });
  it('Social Cohesion on all emoluments; Redundancy/HRD capped at the SI ceiling; Holiday Fund optional', () => {
    const c = employeeContributions(monthly(10000), R);
    expect(total(c.lines, { item: 'socialCohesion' })).toBeCloseTo(0.02 * 120000, 8);
    expect(total(c.lines, { item: 'redundancy' })).toBeCloseTo(0.012 * 68904, 8);
    expect(total(c.lines, { item: 'hrd' })).toBeCloseTo(0.005 * 68904, 8);
    expect(total(c.lines, { item: 'centralHoliday' })).toBe(0);
    const h = employeeContributions({ ...monthly(3000), centralHolidayFund: true }, R);
    expect(total(h.lines, { item: 'centralHoliday' })).toBeCloseTo(0.08 * 36000, 8);
  });
  it('every line has exactly one recipient and no amount is counted twice', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 30000, noNaN: true }), fc.boolean(), (m, hol) => {
        const c = employeeContributions({ ...monthly(m), centralHolidayFund: hol }, R);
        const recipients = [
          'socialInsuranceFund',
          'healthInsuranceOrganisation',
          'socialCohesionFund',
          'redundancyFund',
          'hrdAuthority',
          'centralHolidayFund',
        ] as const;
        const byRecipient = recipients.reduce((s, r) => s + total(c.lines, { recipient: r }), 0);
        return Math.abs(byRecipient - total(c.lines)) < 1e-6;
      }),
    );
  });
});

describe('employer cost and payroll aggregation', () => {
  it('state contributions are not part of the employer’s labour cost', () => {
    const r = employeeResult(salarySchedule(36000), R);
    const employerItems = total(r.contributions.lines, { payer: 'employer' });
    expect(r.employerLabourCost).toBeCloseTo(36000 + employerItems, 8);
    expect(r.employerLabourCost).toBeCloseTo(36000 * (1 + 0.088 + 0.029 + 0.02 + 0.012 + 0.005), 6);
  });
  it('net pay = gross − employee SI − employee GHS − income tax', () => {
    const r = employeeResult(salarySchedule(50000), R);
    expect(r.netPay).toBeCloseTo(50000 - 0.088 * 50000 - 0.0265 * 50000 - r.incomeTax.tax, 8);
  });
  it('the ceiling applies per employee, never to total payroll', () => {
    // 10 employees at €100k: each capped individually.
    const p = payroll([{ headcount: 10, earnings: salarySchedule(100000) }], R);
    expect(p.socialInsuranceFund.employer).toBeCloseTo(10 * 0.088 * 68904, 6);
    // Applying the ceiling once to the €1m payroll would give only 0.088 × 68,904 — wrong.
    expect(p.socialInsuranceFund.employer).toBeGreaterThan(9 * 0.088 * 68904);
  });
  it('payroll is additive over employees, and splitting one high earner changes contributions', () => {
    fc.assert(
      fc.property(
        salary,
        salary,
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 50 }),
        (s1, s2, n1, n2) => {
          const a = payroll([{ headcount: n1, earnings: salarySchedule(s1) }], R);
          const b = payroll([{ headcount: n2, earnings: salarySchedule(s2) }], R);
          const ab = payroll(
            [
              { headcount: n1, earnings: salarySchedule(s1) },
              { headcount: n2, earnings: salarySchedule(s2) },
            ],
            R,
          );
          const close = (x: number, y: number) => Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(x));
          return (
            close(ab.employerLabourCost, a.employerLabourCost + b.employerLabourCost) &&
            close(ab.socialInsuranceFund.state, a.socialInsuranceFund.state + b.socialInsuranceFund.state) &&
            ab.headcount === n1 + n2
          );
        },
      ),
    );
    const one = payroll([{ headcount: 1, earnings: salarySchedule(137808) }], R);
    const two = payroll([{ headcount: 2, earnings: salarySchedule(68904) }], R);
    expect(two.socialInsuranceFund.employee).toBeCloseTo(2 * one.socialInsuranceFund.employee, 6);
    expect(one.grossPayroll).toBeCloseTo(two.grossPayroll, 6);
  });
  it('13 payments: each payment period is capped separately', () => {
    const r12 = employeeContributions(salarySchedule(78000, 12), R); // 6,500/month: capped
    const r13 = employeeContributions(salarySchedule(78000, 13), R); // 6,000 × 13: capped each period
    expect(r12.siInsurableAnnual).toBe(12 * 5742);
    expect(r13.siInsurableAnnual).toBe(13 * 5742);
  });
  it('rejects invalid headcounts', () => {
    expect(() => payroll([{ headcount: 1.5, earnings: salarySchedule(1) }], R)).toThrow();
  });
});
