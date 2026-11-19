import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { cyprusStatutoryRules, loadCyprusDataset } from '../../src/economics/cyprus/defaults';
import { employeeResult } from '../../src/economics/cyprus/employerCosts';
import { salaryWith13th } from '../../src/economics/cyprus/earningsAttribution';
import {
  compareFirm,
  excessProfitCharge,
  firmAccounts,
  labourShareCharge,
  valueAddedCharge,
  type FirmInputs,
} from '../../src/economics/firm/firmModel';
import { ARCHETYPES, DEFAULT_FIRM_POLICY as CFG } from '../../src/economics/firm/archetypes';

const rules = cyprusStatutoryRules(loadCyprusDataset().dataset);
const [hotel, prof, soft] = ARCHETYPES as [FirmInputs, FirmInputs, FirmInputs];

describe('firm accounts', () => {
  it('GVA = revenue − intermediate consumption (turnover is never the base); EBIT identity', () => {
    for (const f of ARCHETYPES) {
      const a = firmAccounts(f, rules);
      expect(a.gva).toBe(f.revenue - f.intermediateConsumption);
      expect(a.ebit).toBeCloseTo(a.gva - a.employeeCompensation - f.depreciation, 6);
      expect(a.employeeCompensation).toBeCloseTo(a.grossPayroll + a.employerStatutory, 6);
    }
  });
  it('existing contributions come from the statutory engine (statutory 8.8%, per employee)', () => {
    const one: FirmInputs = {
      ...hotel,
      employees: [{ label: 'x', headcount: 3, earnings: salaryWith13th(30000) }],
    };
    const a = firmAccounts(one, rules);
    expect(a.employerStatutory).toBeCloseTo(
      3 * employeeResult(salaryWith13th(30000), rules).employerStatutory,
      6,
    );
    expect(rules.socialInsurance.employerRate).toBe(0.088);
  });
  it('makes the €68,904 ceiling visible: high-pay software firm has the largest uninsurable payroll share', () => {
    const shares = ARCHETYPES.map((f) => firmAccounts(f, rules).shareAboveSiCeiling);
    expect(shares[0]).toBeLessThan(0.001); // only Reg. 8(4) euro rounding: nobody earns above the ceiling
    expect(shares[2]).toBeGreaterThan(shares[1]!);
    expect(shares[1]).toBeGreaterThan(0);
  });
  it('rejects inconsistent inputs', () => {
    expect(() => firmAccounts({ ...hotel, intermediateConsumption: hotel.revenue + 1 }, rules)).toThrow();
    expect(() =>
      firmAccounts({ ...hotel, outsourcedLabourCosts: hotel.intermediateConsumption + 1 }, rules),
    ).toThrow();
    expect(() => firmAccounts({ ...hotel, maxProfitShifting: 2 }, rules)).toThrow();
    expect(() =>
      firmAccounts(
        { ...hotel, employees: [{ label: 'x', headcount: 1.5, earnings: salaryWith13th(1) }] },
        rules,
      ),
    ).toThrow();
  });
});

describe('policy E (value added)', () => {
  it('exemptions: sector, size and minimum GVA', () => {
    const a = firmAccounts(hotel, rules);
    expect(valueAddedCharge(hotel, a, { ...CFG.valueAdded, exemptSectors: ['I'] }, rules).liable).toBe(false);
    expect(valueAddedCharge(hotel, a, { ...CFG.valueAdded, minEmployees: 1000 }, rules).liable).toBe(false);
    expect(valueAddedCharge(hotel, a, { ...CFG.valueAdded, minGva: 1e9 }, rules).liable).toBe(false);
  });
  it('static base is GVA; behavioural base shrinks with the elasticity; payroll replacement offsets employer SI', () => {
    const a = firmAccounts(prof, rules);
    const st = valueAddedCharge(prof, a, { ...CFG.valueAdded, baseElasticity: 0 }, rules);
    expect(st.contribution).toBeCloseTo(0.02 * a.gva, 6);
    const be = valueAddedCharge(prof, a, { ...CFG.valueAdded, baseElasticity: 1 }, rules);
    expect(be.base).toBeCloseTo(a.gva * 0.98, 6);
    const rep = valueAddedCharge(prof, a, { ...CFG.valueAdded, payrollReplacement: 1 }, rules);
    expect(rep.payrollRelief).toBeGreaterThan(0);
    expect(rep.netChange).toBeCloseTo(rep.contribution - rep.payrollRelief, 6);
  });
  it('contribution is non-decreasing in the rate up to the revenue-maximising point of B(τ)=B₀(1−τ)^ε', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.3, noNaN: true }),
        fc.double({ min: 0.001, max: 0.05, noNaN: true }),
        (r, h) => {
          const a = firmAccounts(prof, rules);
          const c = (x: number) =>
            valueAddedCharge(prof, a, { ...CFG.valueAdded, rate: x, baseElasticity: 0.5 }, rules)
              .contribution;
          return c(r + h) >= c(r) - 1e-6; // ε = 0.5: revenue rises until τ = 1/(1+ε) ≈ 0.67
        },
      ),
    );
  });
});

describe('policy F (labour share)', () => {
  it('a low labour share alone does not trigger it: the profitability condition protects low-margin firms', () => {
    const lowMarginSoft: FirmInputs = { ...soft, depreciation: 20_000_000 }; // EBIT margin ≈ 4%
    const a = firmAccounts(lowMarginSoft, rules);
    expect(a.labourShare).toBeLessThan(0.5);
    const c = labourShareCharge(lowMarginSoft, a, CFG.labourShare);
    expect(c.liable).toBe(false);
    expect(c.reason).toMatch(/profitability/);
  });
  it('zero when labour share ≥ benchmark; positive for the automated software firm; capped by profit', () => {
    expect(labourShareCharge(hotel, firmAccounts(hotel, rules), CFG.labourShare).contribution).toBe(0);
    const a = firmAccounts(soft, rules);
    const c = labourShareCharge(soft, a, CFG.labourShare);
    expect(c.contribution).toBeGreaterThan(0);
    const capped = labourShareCharge(soft, a, {
      ...CFG.labourShare,
      rate: 5,
      baseElasticity: 0,
      capShareOfProfit: 0.01,
    });
    expect(capped.contribution).toBeCloseTo(0.01 * a.ebit, 6);
  });
  it('counting outsourced labour as labour lowers the base (anti-avoidance setting)', () => {
    const a = firmAccounts(soft, rules);
    const no = labourShareCharge(soft, a, {
      ...CFG.labourShare,
      outsourcingCountedAsLabour: 0,
      baseElasticity: 0,
    });
    const full = labourShareCharge(soft, a, {
      ...CFG.labourShare,
      outsourcingCountedAsLabour: 1,
      baseElasticity: 0,
    });
    expect(no.staticBase - full.staticBase).toBeCloseTo(soft.outsourcedLabourCosts, 6);
  });
  it('sector benchmarks override the default', () => {
    const a = firmAccounts(prof, rules);
    expect(
      labourShareCharge(prof, a, { ...CFG.labourShare, benchmarks: { default: 0.5, M: 0.7 } }).liable,
    ).toBe(true);
    expect(() => labourShareCharge(prof, a, { ...CFG.labourShare, benchmarks: {} })).toThrow();
  });
});

describe('policy G (excess profit)', () => {
  it('base = EBIT − normal return on capital − investment allowance − losses (never negative)', () => {
    const a = firmAccounts(soft, rules);
    const c = excessProfitCharge(soft, a, { ...CFG.excessProfit, shiftingSemiElasticity: 0 });
    expect(c.staticBase).toBeCloseTo(
      a.ebit - 0.06 * soft.capitalStock - soft.aiInvestment - soft.lossesBroughtForward,
      6,
    );
    expect(c.contribution).toBeCloseTo(0.2 * c.staticBase, 6);
    expect(excessProfitCharge(soft, a, { ...CFG.excessProfit, normalReturn: 10 }).liable).toBe(false);
  });
  it("profit shifting reduces the base, bounded by the firm's mobility", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 5, noNaN: true }), (eta) => {
        const a = firmAccounts(soft, rules);
        const c = excessProfitCharge(soft, a, { ...CFG.excessProfit, shiftingSemiElasticity: eta });
        return c.base <= c.staticBase + 1e-6 && c.base >= c.staticBase * (1 - soft.maxProfitShifting) - 1e-6;
      }),
    );
  });
});

describe('comparison across archetypes', () => {
  it('all charges non-negative; the automated software firm bears the most under each policy', () => {
    const cs = ARCHETYPES.map((f) => compareFirm(f, CFG, rules));
    for (const c of cs)
      for (const k of ['valueAdded', 'labourShare', 'excessProfit'] as const)
        expect(c[k].contribution).toBeGreaterThanOrEqual(0);
    for (const k of ['valueAdded', 'labourShare', 'excessProfit'] as const) {
      expect(cs[2]![k].contribution).toBeGreaterThanOrEqual(
        Math.max(cs[0]![k].contribution, cs[1]![k].contribution),
      );
    }
    expect(ARCHETYPES.every((f) => f.hypothetical)).toBe(true);
  });
});
