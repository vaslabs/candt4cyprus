import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import datasetJson from '../../src/data/cyprus2026.json';
import { datasetSchema, parameterSchema } from '../../src/economics/data/provenance';
import {
  cyprusAssumptions,
  cyprusMonthlyEarnings,
  cyprusNationalAccounts2023,
  cyprusStatutoryRules,
  loadCyprusDataset,
} from '../../src/economics/cyprus/defaults';
import { calibrateCyprus } from '../../src/economics/cyprus/calibration';
import { insurableShare } from '../../src/economics/cyprus/earningsDistribution';
import { solveRequiredRobotTax } from '../../src/economics/policies/robotTaxes';
import { techAClosedFormRates } from '../../src/economics/policies/closedForms';
import { paperParameters } from '../../src/economics/paper/calibration';
import { solveSteadyStateDual } from '../../src/economics/paper/steadyState';
import { TEST_RULES } from './statutory.test';

const { dataset, sources } = loadCyprusDataset();
const rules = cyprusStatutoryRules(dataset);
const na = cyprusNationalAccounts2023(dataset);
const earn = cyprusMonthlyEarnings(dataset);
const assume = cyprusAssumptions(dataset, 'B');

describe('provenance dataset and source register', () => {
  it('validates, and every cited source exists', () => {
    expect(dataset.parameters.length).toBeGreaterThan(90);
    expect(sources.length).toBeGreaterThan(25);
  });
  it('every statutory/measured value has a source and evidence; assumptions have ranges', () => {
    for (const p of dataset.parameters) {
      if ((p.category === 'statutory' || p.category === 'measured') && p.value !== null) {
        expect(p.sourceIds.length, p.id).toBeGreaterThan(0);
        expect(p.evidence.length, p.id).toBeGreaterThan(3);
      }
      if (p.category === 'assumption') expect(p.sensitivityRange, p.id).not.toBeNull();
    }
  });
  it('the only statutory value without official confirmation is the annual ceiling (documented)', () => {
    const secondary = dataset.parameters.filter(
      (p) => p.category === 'statutory' && p.verification !== 'verified-official' && p.value !== null,
    );
    expect(secondary.map((p) => p.id)).toEqual(['si.ceilingAnnual']);
  });
  it('an assumption cannot be labelled as an official statistic (schema rejects it)', () => {
    const bad = {
      id: 'x.y',
      label: 'bad',
      value: 1,
      units: 'u',
      referenceYear: '2026',
      coverage: 'Cyprus',
      category: 'assumption',
      verification: 'verified-official',
      sourceIds: [],
      explanation: 'xxx',
      sensitivityRange: [0, 2],
    };
    expect(parameterSchema.safeParse(bad).success).toBe(false);
    expect(
      parameterSchema.safeParse({ ...bad, category: 'measured', verification: 'unverified', sourceIds: [] })
        .success,
    ).toBe(false);
    expect(parameterSchema.safeParse({ ...bad, value: null }).success).toBe(false); // null must be 'missing'
    expect(
      datasetSchema.safeParse({
        ...datasetJson,
        parameters: [...datasetJson.parameters, datasetJson.parameters[0]],
      }).success,
    ).toBe(false);
  });
  it('Social Insurance Fund accounts 2020–2025 come from the SIS final accounts and satisfy their identities', () => {
    const v = (id: string) => dataset.parameters.find((x) => x.id === id)!;
    const val = (id: string) => v(id).value!;
    const inc = [
      'privateEmployees',
      'publicEmployees',
      'selfEmployed',
      'voluntary',
      'state',
      'interest',
      'otherIncome',
    ];
    const exp = ['pensions', 'otherBenefits', 'admin'];
    for (const y of [2020, 2021, 2022, 2023, 2024, 2025]) {
      const a = (k: string) => val(`sif.accounts.${y}.${k}`);
      expect(v(`sif.accounts.${y}.totalIncome`).sourceIds).toEqual(['sis-statistical-bulletins']);
      expect(Math.abs(inc.reduce((t, k) => t + a(k), 0) - a('totalIncome'))).toBeLessThan(0.0015); // €000 rounding
      expect(Math.abs(exp.reduce((t, k) => t + a(k), 0) - a('totalExpenditure'))).toBeLessThan(0.0015);
      expect(Math.abs(a('totalIncome') - a('totalExpenditure') - a('balance'))).toBeLessThan(0.0015);
      if (y > 2020)
        expect(
          Math.abs(val(`sif.accounts.${y - 1}.reserveClosing`) + a('balance') - a('reserveClosing')),
        ).toBeLessThan(0.0015);
    }
    expect(v('sif.accounts.2025.totalIncome').referenceYear).toMatch(/preliminary/);
  });
  it('SIS 2020 accounts reproduce the independent ILO valuation exactly (contributions include the state share)', () => {
    const val = (id: string) => dataset.parameters.find((x) => x.id === id)!.value!;
    const contrib = ['privateEmployees', 'publicEmployees', 'selfEmployed', 'voluntary', 'state'].reduce(
      (t, k) => t + val(`sif.accounts.2020.${k}`),
      0,
    );
    expect(contrib).toBeCloseTo(val('sif.contributions2020'), 1);
    expect(val('sif.accounts.2020.totalExpenditure')).toBeCloseTo(val('sif.expenditure2020'), 1);
    expect(val('sif.accounts.2020.reserveClosing')).toBeCloseTo(val('sif.reserves2020'), 0);
  });
  it('general-government social contributions (D61) are never used as Fund revenue', () => {
    const gg = dataset.parameters.find((x) => x.id === 'macro.ggSocialContributions2025')!;
    expect(gg.coverage).toMatch(/NOT Social Insurance Fund/);
    expect(na.fundContributionsExclState).toBeCloseTo(1860.987, 3); // SIS 2023, not D61 (4,380.5)
    expect(dataset.parameters.find((x) => x.id === 'sif.stateDebtToFund')!.verification).toBe('missing');
  });
  it('user-provided sources are identified by file hashes', () => {
    const s = sources.find((x) => x.id === 'sis-statistical-bulletins')!;
    expect(s.obtainedVia).toBe('provided-by-user');
    expect(s.files.length).toBe(11);
  });
});

describe('statutory rules loaded from the dataset', () => {
  it('match the independently written 2026 test fixture (except the verified deduction cap)', () => {
    expect({ ...rules, incomeTax: { ...rules.incomeTax, contributionDeductionCapShare: null } }).toEqual(
      TEST_RULES,
    );
    expect(rules.incomeTax.contributionDeductionCapShare).toBe(0.2);
  });
  it('the 2029/2034/2039 timeline is configurable and separate from the 2026 baseline', () => {
    expect(cyprusStatutoryRules(dataset, 2029).socialInsurance).toMatchObject({
      employeeRate: 0.093,
      employerRate: 0.093,
      stateRate: 0.055,
      selfEmployedRate: 0.176,
    });
    expect(cyprusStatutoryRules(dataset, 2039).socialInsurance).toMatchObject({
      employeeRate: 0.103,
      stateRate: 0.061,
      selfEmployedRate: 0.196,
    });
    expect(rules.socialInsurance.employeeRate).toBe(0.088);
  });
});

describe('Cyprus calibration (Level 2)', () => {
  const cal = calibrateCyprus(na, rules, assume, earn);
  it('reproduces every targeted moment exactly and yields a valid steady state', () => {
    for (const m of cal.moments.filter((x) => x.targeted))
      expect(Math.abs(m.model - m.data), m.name).toBeLessThan(1e-10);
    expect(cal.steadyState.ok).toBe(true);
    expect(cal.steadyState.ok && cal.steadyState.meta.calibrationPreset).toBe('cyprus-2026');
  });
  it('reports the β diagnostic honestly (fails under K/Y targeting; passes when β is fixed)', () => {
    expect(cal.checks.find((c) => c.name.startsWith('β'))!.pass).toBe(false);
    const fixed = calibrateCyprus(na, rules, { ...assume, betaMode: { kind: 'fixed', beta: 0.975 } }, earn);
    expect(fixed.params.beta).toBe(0.975);
    expect(fixed.moments.find((m) => m.name.startsWith('Capital'))!.targeted).toBe(false);
    expect(fixed.checks.filter((c) => !c.pass)).toEqual([]);
  });
  it('carries over no replication correction: weight calibrated directly, eq. (24) as printed', () => {
    expect(cal.params.variant).toEqual({ techAWeight: 'capitalWeight', labourSupply: 'asPrinted' });
    expect(cal.params.capitalShareParam).not.toBe(0.35);
  });
  it("default (top-down): model SS/Y reproduces the Fund's actual contributions (excl. state) in the base year", () => {
    expect(cal.derived.ssRateMode).toBe('fundAccounts');
    expect(cal.steadyState.ok && cal.steadyState.government.ssTotal / cal.steadyState.levels.Y).toBeCloseTo(
      cal.derived.fundSsRatio,
      12,
    );
    expect(cal.params.taxes.employerSS).toBeLessThan(cal.derived.statutoryBottomUpRate);
  });
  it('bottom-up alternative: statutory 8.8% × insurable share, and it overstates Fund revenue', () => {
    const bu = calibrateCyprus(na, rules, { ...assume, ssRateMode: 'statutoryBottomUp' }, earn);
    expect(bu.params.taxes.employerSS).toBeCloseTo(0.088 * bu.derived.siInsurableShare, 15);
    expect(bu.steadyState.ok && bu.steadyState.government.ssTotal / bu.steadyState.levels.Y).toBeGreaterThan(
      bu.derived.fundSsRatio,
    );
  });
  it('the paper replication preset is untouched', () => {
    const p = paperParameters('A');
    expect([p.beta, p.capitalShareParam, p.taxes.employerSS]).toEqual([0.975, 0.35, 0.1589]);
    const r = solveSteadyStateDual(p);
    expect(r.ok && r.ssToGdp).toBeCloseTo(0.1516, 4);
  });
  it('calibration is invariant to the technology choice at zero adoption (A and B coincide)', () => {
    const a = calibrateCyprus(na, rules, { ...assume, technology: 'A' }, earn);
    expect(a.params.beta).toBe(cal.params.beta);
    expect(a.params.gamma).toBeCloseTo(cal.params.gamma, 12);
  });
});

describe('Propositions 1 and 3 are NOT assumed for Cyprus (MODEL_DEVIATIONS C10)', () => {
  it('with a ceiling fixed in euros the effective SI rate falls as wages rise (C4 of Prop. 1 violated)', () => {
    fc.assert(
      fc.property(fc.double({ min: 1.05, max: 2, noNaN: true }), (k) => {
        const s0 = insurableShare({ mean: 2591, logSd: 0.752 }, 5742);
        return insurableShare({ mean: 2591 * k, logSd: 0.752 }, 5742) < s0;
      }),
    );
  });
  it('under fixed effective rates, Prop. 3 holds for a Tech A Cyprus calibration — and only then', () => {
    const a = calibrateCyprus(na, rules, { ...assume, technology: 'A' }, earn);
    const p = { ...a.params, adoption: 0.2 };
    const r = solveRequiredRobotTax(p, 'robotSS');
    expect(r.status).toBe('solved');
    if (r.status === 'solved') expect(r.rate).toBeCloseTo(techAClosedFormRates(p).robotSS, 9);
    // Lower effective SI rates (e.g. after wage growth with an unindexed ceiling) change the required rate.
    const lower = { ...p, taxes: { ...p.taxes, employerSS: 0.07, employeeSS: 0.07 } };
    const r2 = solveRequiredRobotTax(lower, 'robotSS', { target: r.target });
    expect(r2.status === 'solved' && Math.abs(r2.rate - (r as { rate: number }).rate)).toBeGreaterThan(0.01);
  });
});
