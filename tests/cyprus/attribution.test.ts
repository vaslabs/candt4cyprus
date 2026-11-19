import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  attributeEarnings,
  salaryWith13th,
  PAYMENT_STATUS,
  type AttributedEarnings,
} from '../../src/economics/cyprus/earningsAttribution';
import { employeeContributions, total } from '../../src/economics/cyprus/contributionRules';
import { salarySchedule } from '../../src/economics/cyprus/employerCosts';
import { TEST_RULES as R } from './statutory.test';

const C = 5742;
const months = (m: number, n = 12) => Array.from({ length: n }, () => m);
const all12 = Array.from({ length: 12 }, (_, i) => i);

describe('13th salary (Reg. 8(3): divided over the periods it relates to, capped by unused room)', () => {
  it('full 13th salary below the ceiling is fully insurable', () => {
    const r = attributeEarnings(salaryWith13th(36000), C); // 3,000/month + 3,000 spread = 250/month
    expect(r.grossAnnual).toBe(39000);
    expect(r.siInsurableAnnual).toBe(39000);
    expect(r.insurablePerPeriod.every((x) => x === 3250)).toBe(true);
    expect(r.provisional).toBe(false);
  });
  it('regular pay already at the ceiling: the 13th salary is insured at nil', () => {
    const r = attributeEarnings(salaryWith13th(12 * 6000), C);
    expect(r.payments[0]!.insurable).toBe(0);
    expect(r.siInsurableAnnual).toBe(12 * C);
  });
  it('partial room: only the unused part of each month is insurable, never carried across months', () => {
    // 5,500/month regular → 242 room per month; 13th = 5,500 → 458.33/month share
    const r = attributeEarnings(salaryWith13th(12 * 5500), C);
    expect(r.payments[0]!.insurable).toBeCloseTo(12 * 242, 9);
    expect(r.siInsurableAnnual).toBe(12 * C);
  });
  it('uneven months: room is per period (no pooling)', () => {
    const regular = [...months(5742, 6), ...months(2000, 6)];
    const r = attributeEarnings(
      {
        attribution: 'earning-period',
        periodType: 'monthly',
        regular,
        payments: [{ kind: 'thirteenthSalary', amount: 12000, periods: all12 }],
      },
      C,
    );
    expect(r.payments[0]!.insurable).toBe(6 * 1000); // 1,000/month share fits only in the low months
  });
  it('prorated 13th salary (6 months of service) is spread over the months employed and flagged provisional', () => {
    const e = salaryWith13th(36000, { monthsEmployed: 6 });
    const r = attributeEarnings(e, C);
    expect(e.payments![0]!.kind).toBe('thirteenthSalaryProrated');
    expect(e.payments![0]!.amount).toBe(1500);
    expect(r.insurablePerPeriod.slice(0, 6).every((x) => x === 3250)).toBe(true);
    expect(r.insurablePerPeriod.slice(6).every((x) => x === 0)).toBe(true);
    expect(r.provisional).toBe(true);
  });
});

describe('commissions, bonuses and post-termination payments', () => {
  const base = (payments: AttributedEarnings['payments']): AttributedEarnings => ({
    attribution: 'earning-period',
    periodType: 'monthly',
    regular: months(4000),
    payments,
  });
  it('quarterly commission is spread over its quarter (verified rule)', () => {
    const r = attributeEarnings(base([{ kind: 'commission', amount: 9000, periods: [0, 1, 2] }]), C);
    expect(r.insurablePerPeriod.slice(0, 3)).toEqual([5742, 5742, 5742]); // 4,000 + 3,000 capped
    expect(r.payments[0]!.insurable).toBe(3 * 1742);
    expect(r.payments[0]!.status).toBe('verified');
  });
  it('irregular one-off bonus attributed to its payment month only (provisional)', () => {
    const r = attributeEarnings(base([{ kind: 'bonus', amount: 10000, periods: [5] }]), C);
    expect(r.insurablePerPeriod[5]).toBe(5742);
    expect(r.payments[0]!.insurable).toBe(1742);
    expect(r.provisional).toBe(true);
  });
  it('post-termination arrears attributed to the periods they relate to (provisional)', () => {
    const regular = [...months(4000, 9), 0, 0, 0]; // employment ends after September
    const r = attributeEarnings(
      {
        attribution: 'earning-period',
        periodType: 'monthly',
        regular,
        payments: [{ kind: 'postTermination', amount: 1800, periods: [6, 7, 8] }],
      },
      C,
    );
    expect(r.insurablePerPeriod.slice(6, 9)).toEqual([4600, 4600, 4600]);
    expect(r.insurablePerPeriod.slice(9)).toEqual([0, 0, 0]);
    expect(PAYMENT_STATUS.postTermination.status).toBe('provisional');
  });
  it('rejects invalid attributions', () => {
    expect(() => attributeEarnings(base([{ kind: 'bonus', amount: 1, periods: [] }]), C)).toThrow();
    expect(() => attributeEarnings(base([{ kind: 'bonus', amount: 1, periods: [12] }]), C)).toThrow();
    expect(() => attributeEarnings(base([{ kind: 'bonus', amount: 1, periods: [1, 1] }]), C)).toThrow();
    expect(() => attributeEarnings(base([{ kind: 'bonus', amount: -1, periods: [1] }]), C)).toThrow();
    expect(() => salaryWith13th(1, { monthsEmployed: 0 })).toThrow();
  });
  it('insurable earnings are rounded to whole euros per period (Reg. 8(4))', () => {
    const r = attributeEarnings(
      { attribution: 'earning-period', periodType: 'monthly', regular: [1000.4, 1000.6], payments: [] },
      C,
    );
    expect(r.insurablePerPeriod).toEqual([1000, 1001]);
  });
});

describe('properties of earning-period attribution', () => {
  const arb = fc.record({
    regular: fc.array(fc.double({ min: 0, max: 9000, noNaN: true }), { minLength: 12, maxLength: 12 }),
    payments: fc.array(
      fc.record({
        kind: fc.constantFrom('thirteenthSalary' as const, 'commission' as const, 'bonus' as const),
        amount: fc.double({ min: 0, max: 20000, noNaN: true }),
        periods: fc.uniqueArray(fc.integer({ min: 0, max: 11 }), { minLength: 1, maxLength: 12 }),
      }),
      { maxLength: 4 },
    ),
  });
  it('per-period insurable ≤ ceiling, total ≤ gross, and payment order cannot exceed the ceiling', () => {
    fc.assert(
      fc.property(arb, ({ regular, payments }) => {
        const r = attributeEarnings(
          { attribution: 'earning-period', periodType: 'monthly', regular, payments, roundToEuro: false },
          C,
        );
        return (
          r.insurablePerPeriod.every((x) => x <= C + 1e-9) && r.siInsurableAnnual <= r.grossAnnual + 1e-6
        );
      }),
    );
  });
  it('total insurable does not depend on the order of payments (sum of per-period minima)', () => {
    fc.assert(
      fc.property(arb, ({ regular, payments }) => {
        const a = attributeEarnings(
          { attribution: 'earning-period', periodType: 'monthly', regular, payments, roundToEuro: false },
          C,
        );
        const b = attributeEarnings(
          {
            attribution: 'earning-period',
            periodType: 'monthly',
            regular,
            payments: [...payments].reverse(),
            roundToEuro: false,
          },
          C,
        );
        return Math.abs(a.siInsurableAnnual - b.siInsurableAnnual) < 1e-6;
      }),
    );
  });
  it('never more insurable than the legacy independent-payment rule for a 13th salary', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 200000, noNaN: true }), (annual) => {
        const attributed = employeeContributions(salaryWith13th((annual * 12) / 13), R).siInsurableAnnual;
        const legacy = employeeContributions(salarySchedule(annual, 13), R).siInsurableAnnual;
        return attributed <= legacy + 13; // ≤ rounding of 13 periods
      }),
    );
  });
});

describe('integration with the statutory engine', () => {
  it('contributions use the attributed base; Social Cohesion uses full gross; rule is reported', () => {
    const c = employeeContributions(salaryWith13th(12 * 6000), R);
    expect(c.ceilingRule).toBe('earning-period-attribution (Reg. 8(3))');
    expect(c.siInsurableAnnual).toBe(12 * C);
    expect(total(c.lines, { item: 'si', payer: 'employee' })).toBeCloseTo(0.088 * 12 * C, 6);
    expect(total(c.lines, { item: 'socialCohesion' })).toBeCloseTo(0.02 * 78000, 6);
    expect(employeeContributions(salarySchedule(78000, 13), R).ceilingRule).toBe(
      'legacy-independent-payment (assumption)',
    );
  });
  it('legacy rule overstates the insurable base for high earners with a 13th salary', () => {
    const attributed = employeeContributions(salaryWith13th(12 * 6000), R).siInsurableAnnual;
    const legacy = employeeContributions(salarySchedule(78000, 13), R).siInsurableAnnual;
    expect(attributed).toBe(68904);
    expect(legacy).toBe(13 * 5742);
  });
});
