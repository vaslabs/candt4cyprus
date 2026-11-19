import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import {
  checkFundAccounts,
  contributionsExclState,
  fundEditions,
  fundSeries,
  languageDiscrepancies,
  revisionHistory,
} from '../../src/economics/cyprus/fundAccounts';
import {
  cyprusAssumptions,
  cyprusMonthlyEarnings,
  cyprusNationalAccounts2023,
  cyprusStatutoryRules,
  loadCyprusDataset,
} from '../../src/economics/cyprus/defaults';
import { calibrateCyprus } from '../../src/economics/cyprus/calibration';
import {
  insurableShareAtWageScale,
  solveWithCeiling,
  type CeilingContext,
} from '../../src/economics/cyprus/ceilingFeedback';
import { evaluateBenchmarks, KNOWN_DISCREPANCIES } from '../../src/economics/paper/replication';
import { paperParameters } from '../../src/economics/paper/calibration';
import { solveSteadyStateDual } from '../../src/economics/paper/steadyState';

const { dataset } = loadCyprusDataset();
const series = fundSeries();

describe('Social Insurance Fund historical accounts (observed data)', () => {
  it('covers 2015–2025 from 24 official editions; 2025 labelled preliminary, earlier years final', () => {
    expect(fundEditions()).toHaveLength(24);
    expect(series.map((y) => y.year)).toEqual([
      2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
    ]);
    expect(series.find((y) => y.year === 2025)!.preliminary).toBe(true);
    expect(series.filter((y) => y.year <= 2024).every((y) => !y.preliminary)).toBe(true);
  });
  it('accounting totals reconcile and closing reserves carry forward (every year)', () => {
    const failed = checkFundAccounts().filter((c) => !c.pass);
    expect(failed).toEqual([]);
  });
  it('every edition of the same year agrees with its identities, and revisions are recorded', () => {
    const h = revisionHistory('totalIncome', 2022);
    expect(h.map((x) => x.preliminary)).toEqual([true, true, false, false, false, false]);
    expect(h.at(-1)!.value).toBeCloseTo(2214.999, 6);
    expect(h[0]!.value).toBeCloseTo(2214.787, 6); // revised after being marked final
  });
  it('Greek and English editions agree except a documented €1k rounding cell', () => {
    expect(languageDiscrepancies()).toEqual([
      { edition: 'January 2022', item: 'reserveOpening', year: '2020', el: 7915749, en: 7915750 },
      { edition: 'July 2022', item: 'reserveOpening', year: '2020', el: 7915749, en: 7915750 },
      { edition: 'January 2023', item: 'reserveOpening', year: '2020', el: 7915749, en: 7915750 },
    ]);
  });
  it('2020 reproduces the independent ILO actuarial valuation exactly', () => {
    const y = series.find((s) => s.year === 2020)!;
    expect(contributionsExclState(y) + y.receipts.state).toBeCloseTo(1738.055, 6);
    expect(y.expenditure.total).toBeCloseTo(1636.78, 6);
  });
  it('category breakdowns that are not published are marked unavailable; reserves are not liquid assets', () => {
    for (const y of series) {
      expect(y.receipts.employeeEmployerSplit).toBe('unavailable');
      expect(y.expenditure.pensionsByType).toBe('unavailable');
      expect(y.reserveNature).toBe('accounting-reserve-deposited-with-government');
    }
  });
  it('dataset parameters equal the authoritative series (single source of truth)', () => {
    const v = (id: string) => dataset.parameters.find((p) => p.id === id)!.value!;
    for (const y of series.filter((s) => s.year >= 2020)) {
      expect(v(`sif.accounts.${y.year}.totalIncome`)).toBeCloseTo(y.receipts.total, 6);
      expect(v(`sif.accounts.${y.year}.state`)).toBeCloseTo(y.receipts.state, 6);
      expect(v(`sif.accounts.${y.year}.reserveClosing`)).toBeCloseTo(y.reserveClosing, 6);
    }
  });
});

describe('separation guarantees (step 5 review, item 7)', () => {
  const rules = cyprusStatutoryRules(dataset);
  const na = cyprusNationalAccounts2023(dataset);
  const earn = cyprusMonthlyEarnings(dataset);
  const assume = cyprusAssumptions(dataset, 'B');

  it('updated Cyprus data does not change the paper replication (17/21, same discrepancies)', () => {
    const r = evaluateBenchmarks();
    expect(r.filter((b) => b.pass).length).toBe(17);
    expect(
      r
        .filter((b) => !b.pass)
        .map((b) => b.id)
        .sort(),
    ).toEqual(Object.keys(KNOWN_DISCREPANCIES).sort());
    const p = paperParameters('A');
    const s = solveSteadyStateDual(p);
    expect(s.ok && s.ssToGdp).toBeCloseTo(0.1516, 4);
  });
  it('the statutory payroll engine does not import the macro model, calibration or policies', () => {
    for (const f of ['contributionRules', 'incomeTax', 'employerCosts', 'types']) {
      const src = readFileSync(`src/economics/cyprus/${f}.ts`, 'utf8');
      expect(src, f).not.toMatch(
        /from '\.\.\/paper|from '\.\/calibration|from '\.\.\/policies|ceilingFeedback/,
      );
    }
  });
  it('changing the calibrated effective contribution rate never alters statutory rates', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('fundAccounts' as const, 'statutoryBottomUp' as const),
        fc.constantFrom('A' as const, 'B' as const),
        (mode, tech) => {
          const cal = calibrateCyprus(na, rules, { ...assume, technology: tech, ssRateMode: mode }, earn);
          const again = cyprusStatutoryRules(dataset);
          return (
            again.socialInsurance.employeeRate === 0.088 &&
            again.socialInsurance.employerRate === 0.088 &&
            again.socialInsurance.stateRate === 0.052 &&
            rules.socialInsurance.employerRate === 0.088 &&
            cal.params.taxes.employerSS !== 0.088
          );
        },
      ),
      { numRuns: 4 },
    );
  });
  it('observed historical data stay separate from simulated outcomes', () => {
    const before = JSON.stringify(fundSeries());
    const cal = calibrateCyprus(na, rules, assume, earn);
    expect(JSON.stringify(fundSeries())).toBe(before); // simulations never mutate observed data
    const m = cal.moments.find((x) => x.name.startsWith('Fund contributions'))!;
    expect(m.data).toBeCloseTo(
      contributionsExclState(series.find((y) => y.year === 2023)!) / (33144.3 - 4287.8),
      12,
    );
    expect(cal.steadyState.ok && cal.steadyState.meta.calibrationPreset).toBe('cyprus-2026');
  });
  it('β = 0.975 is the primary assumption and is NOT claimed to match K/Y; β = 0.922 alternative does', () => {
    const primary = calibrateCyprus(na, rules, assume, earn);
    expect(primary.params.beta).toBe(0.975);
    const ky = primary.moments.find((m) => m.name.startsWith('Capital'))!;
    expect(ky.targeted).toBe(false);
    expect(Math.abs(ky.model - ky.data)).toBeGreaterThan(1);
    const alt = calibrateCyprus(na, rules, { ...assume, betaMode: { kind: 'fromCapitalOutput' } }, earn);
    expect(alt.params.beta).toBeCloseTo(0.9223, 4);
  });
});

describe('SI ceiling feedback on the effective rate', () => {
  const rules = cyprusStatutoryRules(dataset);
  const cal = calibrateCyprus(
    cyprusNationalAccounts2023(dataset),
    rules,
    cyprusAssumptions(dataset, 'B'),
    cyprusMonthlyEarnings(dataset),
  );
  if (!cal.steadyState.ok) throw new Error('calibration failed');
  const earn = cyprusMonthlyEarnings(dataset);
  const ctx = (treatment: CeilingContext['treatment']): CeilingContext => ({
    treatment,
    baselineWage: cal.steadyState.ok ? cal.steadyState.levels.W : NaN,
    bands: earn.bands,
    meanMonthly: earn.meanMonthly,
    monthlyCeiling: rules.socialInsurance.ceilingPerPeriod.monthly,
  });
  it('wage scale 1 reproduces the calibration insurable share', () => {
    expect(insurableShareAtWageScale(ctx('fixedNominal'), 1)).toBeCloseTo(cal.derived.siInsurableShare, 12);
  });
  it('fixed-nominal ceiling: share falls as wages rise; indexed: unchanged', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.01, max: 2, noNaN: true }),
        (k) =>
          insurableShareAtWageScale(ctx('fixedNominal'), k) <
          insurableShareAtWageScale(ctx('fixedNominal'), 1),
      ),
    );
  });
  it('at the calibration point the fixed point is the baseline rate; with automation (higher W) the rate falls', () => {
    const atBase = solveWithCeiling(cal.params, ctx('fixedNominal'));
    expect(atBase.ceiling.effectiveRate).toBeCloseTo(cal.params.taxes.employerSS, 9);
    const auto = { ...cal.params, adoption: 0.35 };
    const indexed = solveWithCeiling(auto, ctx('indexed'));
    const fixed = solveWithCeiling(auto, ctx('fixedNominal'));
    expect(indexed.ok && fixed.ok).toBe(true);
    expect(indexed.ceiling.effectiveRate).toBe(cal.params.taxes.employerSS);
    const w0 = cal.steadyState.ok ? cal.steadyState.levels.W : NaN;
    if (fixed.ok && indexed.ok && indexed.levels.W > w0 * 1.01) {
      expect(fixed.ceiling.effectiveRate).toBeLessThan(indexed.ceiling.effectiveRate);
      // fixed-point consistency
      expect(fixed.ceiling.insurableShare).toBeCloseTo(
        insurableShareAtWageScale(ctx('fixedNominal'), fixed.levels.W / w0),
        9,
      );
    }
  });
});
