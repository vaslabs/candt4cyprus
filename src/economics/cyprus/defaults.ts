/**
 * Builds typed Cyprus inputs from the validated provenance dataset (src/data/cyprus2026.json).
 * Every number used by the Cyprus model is looked up here by parameter id; there are no
 * hard-coded Cyprus values elsewhere in the economics layer.
 */
import datasetJson from '../../data/cyprus2026.json';
import sourcesJson from '../../data/sources.json';
import {
  datasetSchema,
  parameterValue,
  sourceSchema,
  unresolvedSourceIds,
  type Dataset,
  type Source,
} from '../data/provenance';
import type { CyprusAssumptions, CyprusNationalAccounts } from './calibration';
import { validateBands } from './incomeTax';
import type { CyprusStatutoryRules, IncomeTaxBand } from './types';

export function loadCyprusDataset(): { dataset: Dataset; sources: Source[] } {
  const dataset = datasetSchema.parse(datasetJson);
  const sources = sourceSchema.array().parse(sourcesJson);
  const missing = unresolvedSourceIds(dataset, sources);
  if (missing.length) throw new Error(`unresolved source ids: ${missing.join(', ')}`);
  return { dataset, sources };
}

export type SiScheduleYear = 2026 | 2029 | 2034 | 2039;

/** Statutory rules; `siSchedule` selects the configurable SI rate timeline (2026 baseline by default). */
export function cyprusStatutoryRules(d: Dataset, siSchedule: SiScheduleYear = 2026): CyprusStatutoryRules {
  const v = (id: string) => parameterValue(d, id);
  const s = (k: string) => (siSchedule === 2026 ? v(`si.${k}`) : v(`si.schedule${siSchedule}.${k}`));
  const bands: IncomeTaxBand[] = [];
  for (let i = 0; d.parameters.some((p) => p.id === `tax.band${i}.rate`); i++) {
    const to = d.parameters.find((p) => p.id === `tax.band${i}.to`);
    bands.push({
      from: v(`tax.band${i}.from`),
      to: to ? v(`tax.band${i}.to`) : null,
      rate: v(`tax.band${i}.rate`),
    });
  }
  validateBands(bands);
  const cap = d.parameters.find((p) => p.id === 'tax.contributionDeductionCapShare');
  const ghsState = d.parameters.find((p) => p.id === 'ghs.stateRate');
  return {
    year: siSchedule,
    socialInsurance: {
      employeeRate: s('employeeRate'),
      employerRate: s('employerRate'),
      stateRate: s('stateRate'),
      selfEmployedRate: s('selfEmployedRate'),
      stateRateSelfEmployed: s('stateRate'),
      ceilingPerPeriod: { monthly: v('si.ceilingMonthly'), weekly: v('si.ceilingWeekly') },
      annualCeiling: 12 * v('si.ceilingMonthly'),
    },
    ghs: {
      employeeRate: v('ghs.employeeRate'),
      employerRate: v('ghs.employerRate'),
      stateRate: ghsState && ghsState.value !== null ? ghsState.value : null,
      selfEmployedRate: v('ghs.selfEmployedRate'),
      annualCeiling: v('ghs.annualCeiling'),
    },
    employerFunds: {
      socialCohesion: { rate: v('funds.socialCohesionRate'), base: 'none', recipient: 'socialCohesionFund' },
      redundancy: { rate: v('funds.redundancyRate'), base: 'siCeiling', recipient: 'redundancyFund' },
      hrd: { rate: v('funds.hrdRate'), base: 'siCeiling', recipient: 'hrdAuthority' },
      centralHoliday: {
        rate: v('funds.centralHolidayRate'),
        base: 'siCeiling',
        recipient: 'centralHolidayFund',
      },
      hrdSelfEmployedRate: v('funds.hrdSelfEmployedRate'),
    },
    incomeTax: { bands, contributionDeductionCapShare: cap && cap.value !== null ? cap.value : null },
    corporateTaxRate: v('tax.corporateRate'),
    vatStandardRate: v('tax.vatStandardRate'),
  };
}

export function cyprusNationalAccounts2023(d: Dataset): CyprusNationalAccounts {
  const v = (k: string) => parameterValue(d, `na2023.${k}`);
  return {
    year: 2023,
    gdp: v('gdp'),
    compensationOfEmployees: v('compensationOfEmployees'),
    wagesAndSalaries: v('wagesAndSalaries'),
    grossOperatingSurplusMixedIncome: v('grossOperatingSurplusMixedIncome'),
    mixedIncome: v('mixedIncome'),
    netTaxesOnProductionImports: v('netTaxesOnProductionImports'),
    consumptionOfFixedCapital: v('consumptionOfFixedCapital'),
    netFixedCapitalStock: v('netFixedCapitalStock'),
    grossFixedCapitalFormation: v('grossFixedCapitalFormation'),
    privateConsumption: v('privateConsumption'),
    governmentConsumption: v('governmentConsumption'),
    employedThousands: v('employedThousands'),
    employeesThousands: v('employeesThousands'),
    hoursWorkedThousands: v('hoursWorkedThousands'),
    personalIncomeTax: v('personalIncomeTax'),
    corporateIncomeTax: v('corporateIncomeTax'),
    taxesOnProducts: v('taxesOnProducts'),
    fundContributionsExclState: (
      ['privateEmployees', 'publicEmployees', 'selfEmployed', 'voluntary'] as const
    ).reduce((s, k) => s + parameterValue(d, `sif.accounts.2023.${k}`), 0),
  };
}

export function cyprusAssumptions(d: Dataset, technology: 'A' | 'B' = 'B'): CyprusAssumptions {
  const v = (k: string) => parameterValue(d, `assume.${k}`);
  return {
    technology,
    elasticityKL: v('elasticityKL'),
    elasticityAuto: v('elasticityAuto'),
    deltaD: v('deltaD'),
    timeEndowmentHours: v('timeEndowmentHours'),
    earningsLogSd: v('earningsLogSd'),
    baselineAdoption: v('baselineAdoption'),
  };
}

import bandsJson from '../../data/earningsBands2025.json';
import { z } from 'zod';
import type { CrossCheckInputs } from './crossChecks';
import type { MonthlyEarningsData } from './calibration';

const bandsSchema = z.object({
  sourceId: z.string(),
  year: z.number(),
  bands: z
    .array(z.object({ from: z.number().min(0), to: z.number().nullable(), share: z.number().min(0).max(1) }))
    .min(2),
});

export function cyprusMonthlyEarnings(d: Dataset): MonthlyEarningsData {
  const b = bandsSchema.parse(bandsJson);
  return { year: b.year, meanMonthly: parameterValue(d, 'earnings.meanMonthly2025'), bands: b.bands };
}

export function cyprusCrossCheckInputs(d: Dataset): CrossCheckInputs {
  const bands = bandsSchema.parse(bandsJson).bands;
  const v = (id: string) => parameterValue(d, id);
  return {
    earningsBands: bands,
    meanMonthly: v('earnings.meanMonthly2025'),
    medianMonthly: v('earnings.medianMonthly2025'),
    monthlyCeiling: v('si.ceilingMonthly'),
    observedShareAboveCeiling: v('earnings.shareAtOrAbove5750_2025'),
    sifContributions2020: v('sif.contributions2020'),
    gdp2020: v('macro.gdp2020'),
    ageingReportEmployerEmployeePctGdp2022: v('sif.ageingReportEmployerEmployeePctGdp2022'),
    meanInsurableEarnings2023: v('sif.meanInsurableEarningsEmployees.2023'),
    meanWagePerEmployee2023: (v('na2023.wagesAndSalaries') * 1e6) / (v('na2023.employeesThousands') * 1e3),
    fundContributionsInclState2025: (
      ['privateEmployees', 'publicEmployees', 'selfEmployed', 'voluntary', 'state'] as const
    ).reduce((s, k) => s + v(`sif.accounts.2025.${k}`), 0),
    gdp2025: v('macro.gdp2025'),
  };
}
