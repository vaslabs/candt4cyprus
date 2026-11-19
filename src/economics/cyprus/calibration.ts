/**
 * Level 2: calibrating the Casas–Torres steady state to Cyprus (MODEL_SPEC §8, MODEL_DEVIATIONS
 * Cyprus section). Kept separate from the paper replication preset; none of the replication
 * variants (D1, D2) is reused. The capital weight is calibrated directly, and eq. (24) is used as
 * printed.
 *
 * Closed-form procedure (all ratios in one base year, so K matches the flows):
 *   1. Labour cost share of factor income (self-employed imputed at the employee average):
 *        s_L = D1·(employed/employees) / (GDP − (D2−D3))
 *   2. Capital–output ratio K/Y = net fixed capital stock / factor-cost output; δ_k = CFC / K.
 *   3. Zero profit with no robots ⇒ R_k = (1 − s_L) / (K/Y).
 *   4. Euler (25) ⇒ 1/β = 1 + (1−τ^k)(R_k − δ_k).
 *   5. Unit cost = 1 ⇒ s_K = w_K^ρ R_k^(1−ρ) ⇒ w_K = (s_K R_k^(ρ−1))^(1/ρ).
 *   6. Labour supply (24) ⇒ γ from the hours share L (an ASSUMPTION about the time endowment).
 * Effective tax rates come from national accounts. Effective SI rates are statutory rates times
 * the insurable share of the wage bill (a lognormal ASSUMPTION; see earningsDistribution.ts).
 */
import { solveSteadyStateDual } from '../paper/steadyState';
import type { PaperParameters, SteadyStateResult, Technology } from '../paper/types';
import { insurableShare, insurableShareFromBands, type EarningsBand } from './earningsDistribution';
import type { CyprusStatutoryRules } from './types';

export const CYPRUS_PRESET_ID = 'cyprus-2026';

/** Measured national-accounts inputs for ONE base year (€ million unless stated). */
export interface CyprusNationalAccounts {
  readonly year: number;
  readonly gdp: number;
  readonly compensationOfEmployees: number; // D1
  readonly wagesAndSalaries: number; // D11
  readonly grossOperatingSurplusMixedIncome: number; // B2A3G
  readonly mixedIncome: number; // B3G
  readonly netTaxesOnProductionImports: number; // D2−D3
  readonly consumptionOfFixedCapital: number; // P51C
  readonly netFixedCapitalStock: number; // N11N, current replacement cost
  readonly grossFixedCapitalFormation: number; // P51G
  readonly privateConsumption: number; // P31 S14_S15
  readonly governmentConsumption: number; // P3 S13
  readonly employedThousands: number; // EMP_DC
  readonly employeesThousands: number; // SAL_DC
  readonly hoursWorkedThousands: number; // EMP_DC, THS_HW
  readonly personalIncomeTax: number; // D51A, S13 receivable
  readonly corporateIncomeTax: number; // D51B
  readonly taxesOnProducts: number; // D21, S13 receivable
}

/** Structural assumptions (not measured); each has a range in the data file. */
export interface CyprusAssumptions {
  readonly technology: Technology;
  /** ρ / ε: K–L elasticity. */
  readonly elasticityKL: number;
  /** υ / σ: elasticity involving autonomous capital. */
  readonly elasticityAuto: number;
  readonly deltaD: number;
  /** Annual time endowment (hours) for the hours share L. */
  readonly timeEndowmentHours: number;
  /** Earnings dispersion for the lognormal insurable-share bridge (log-sd). */
  readonly earningsLogSd: number;
  /**
   * Insurable-share method (MODEL_DEVIATIONS C4). Both use CYSTAT monthly earnings so the ceiling and
   * the earnings refer to (nearly) the same year:
   *  'bands' (default): tail-free estimate from the banded distribution and the published mean;
   *  'lognormal': lognormal with the published mean and `earningsLogSd`.
   */
  readonly insurableShareMethod?: 'bands' | 'lognormal';
  /** Adoption parameter in the base year (no Cyprus estimate exists; scenario value). */
  readonly baselineAdoption: number;
  /**
   * How β is determined.
   *  'fromCapitalOutput' (default): β from the Euler equation with R_k = s_K/(K/Y); K/Y is targeted.
   *  'fixed': β is set (e.g. the paper's 0.975); R_k follows from (25) and K/Y becomes untargeted.
   */
  readonly betaMode?:
    { readonly kind: 'fromCapitalOutput' } | { readonly kind: 'fixed'; readonly beta: number };
}

export interface CalibrationMoment {
  readonly name: string;
  readonly data: number;
  readonly model: number;
  readonly targeted: boolean;
  readonly note: string;
}

export interface CalibrationResult {
  readonly params: PaperParameters;
  readonly derived: {
    readonly labourCostShare: number;
    readonly capitalOutput: number;
    readonly Rk: number;
    readonly deltaK: number;
    readonly hoursShare: number;
    readonly siInsurableShare: number;
    readonly insurableShareMethod: 'bands' | 'lognormal';
    readonly earningsYear: number;
    readonly taxes: {
      readonly consumption: number;
      readonly labour: number;
      readonly capital: number;
      readonly employerSS: number;
      readonly employeeSS: number;
    };
  };
  readonly steadyState: SteadyStateResult;
  readonly moments: readonly CalibrationMoment[];
  readonly checks: readonly { readonly name: string; readonly pass: boolean; readonly detail: string }[];
}

/** Monthly earnings data for the insurable-share bridge (CYSTAT; year stated by caller). */
export interface MonthlyEarningsData {
  readonly year: number;
  readonly meanMonthly: number;
  readonly bands: readonly EarningsBand[];
}

export function calibrateCyprus(
  na: CyprusNationalAccounts,
  rules: CyprusStatutoryRules,
  a: CyprusAssumptions,
  earnings: MonthlyEarningsData,
): CalibrationResult {
  // Step 1–3: shares, capital, returns
  const factorOutput = na.gdp - na.netTaxesOnProductionImports;
  const labourIncome = na.compensationOfEmployees * (na.employedThousands / na.employeesThousands);
  const sL = labourIncome / factorOutput;
  const sK = 1 - sL;
  const KYdata = na.netFixedCapitalStock / factorOutput;
  const deltaK = na.consumptionOfFixedCapital / na.netFixedCapitalStock;

  // Effective tax rates (national accounts; ASSUMED incidence documented in the data file)
  const netCapitalIncome = factorOutput - labourIncome - na.consumptionOfFixedCapital;
  const tauK = na.corporateIncomeTax / netCapitalIncome;
  const tauL = na.personalIncomeTax / (na.wagesAndSalaries + na.mixedIncome);
  const consumption = na.privateConsumption + na.governmentConsumption;
  const tauC = na.taxesOnProducts / (consumption - na.taxesOnProducts);

  // Effective SI (Social Insurance Fund only) rates on the wage bill
  const ceiling = rules.socialInsurance.ceilingPerPeriod.monthly;
  const method = a.insurableShareMethod ?? 'bands';
  const share =
    method === 'bands'
      ? insurableShareFromBands(earnings.bands, earnings.meanMonthly, ceiling)
      : insurableShare({ mean: earnings.meanMonthly, logSd: a.earningsLogSd }, ceiling);
  const tauSse = rules.socialInsurance.employerRate * share;
  const tauSsw = rules.socialInsurance.employeeRate * share;

  // Step 3–4: R_k and β (mode-dependent)
  const mode = a.betaMode ?? { kind: 'fromCapitalOutput' as const };
  const Rk = mode.kind === 'fixed' ? (1 / mode.beta - 1 + (1 - tauK) * deltaK) / (1 - tauK) : sK / KYdata;
  const beta = mode.kind === 'fixed' ? mode.beta : 1 / (1 + (1 - tauK) * (Rk - deltaK));
  const KY = sK / Rk;
  // Step 5: capital weight
  const rho = a.elasticityKL;
  const capitalWeight = (sK * Rk ** (rho - 1)) ** (1 / rho);

  // Step 6: γ from hours share via (24), using the model's own ratios at adoption 0.
  const hoursShare = na.hoursWorkedThousands / na.employedThousands / a.timeEndowmentHours;
  const base: PaperParameters = {
    technology: a.technology,
    beta,
    gamma: 0.5, // placeholder, replaced below
    deltaK,
    deltaD: a.deltaD,
    capitalShareParam: capitalWeight,
    elasticityKL: rho,
    elasticityAuto: a.elasticityAuto,
    adoption: 0,
    taxes: {
      consumption: tauC,
      labour: tauL,
      employerSS: tauSse,
      employeeSS: tauSsw,
      capital: tauK,
      robotIncome: 0,
      robotInvestment: 0,
      robotSS: 0,
    },
    variant: { techAWeight: 'capitalWeight', labourSupply: 'asPrinted' },
  };
  const probe = solveSteadyStateDual(base);
  let gamma = NaN;
  if (probe.ok) {
    const ly = probe.levels.L / probe.levels.Y;
    const cy = probe.levels.C / probe.levels.Y;
    // (1+τc)·cy/ly·L = γ/(1−γ)·(1−L)·W·(1−τl−τssw)  ⇒  solve for g = γ/(1−γ)
    const g = ((1 + tauC) * cy * hoursShare) / (ly * (1 - hoursShare) * probe.levels.W * (1 - tauL - tauSsw));
    gamma = g / (1 + g);
  }
  const params: PaperParameters = { ...base, gamma, adoption: a.baselineAdoption };
  const ss = solveSteadyStateDual(params, { calibrationPreset: CYPRUS_PRESET_ID });
  const atZero = solveSteadyStateDual({ ...params, adoption: 0 });

  const moments: CalibrationMoment[] = [];
  const checks: { name: string; pass: boolean; detail: string }[] = [];
  const incomeIdentity =
    na.compensationOfEmployees +
    na.grossOperatingSurplusMixedIncome +
    na.netTaxesOnProductionImports -
    na.gdp;
  checks.push({
    name: 'Income-approach GDP identity (D1 + B2A3G + D2−D3 = GDP)',
    pass: Math.abs(incomeIdentity) <= 0.5,
    detail: `residual €${incomeIdentity.toFixed(1)}m (rounding tolerance €0.5m)`,
  });
  checks.push({
    name: 'Net return on capital positive (R_k > δ_k)',
    pass: Rk > deltaK,
    detail: `R_k = ${Rk.toFixed(4)}, δ_k = ${deltaK.toFixed(4)}`,
  });
  checks.push({
    name:
      mode.kind === 'fixed'
        ? 'β fixed by assumption (K/Y untargeted)'
        : 'β in the conventional range [0.95, 0.99]',
    pass: mode.kind === 'fixed' || (beta >= 0.95 && beta <= 0.99),
    detail: `β = ${beta.toFixed(4)} (implied annual net after-tax return ${((1 / beta - 1) * 100).toFixed(2)}%)`,
  });
  checks.push({
    name: 'Capital weight in (0,1)',
    pass: capitalWeight > 0 && capitalWeight < 1,
    detail: `w_K = ${capitalWeight.toFixed(4)}`,
  });
  checks.push({ name: 'γ in (0,1)', pass: gamma > 0 && gamma < 1, detail: `γ = ${gamma.toFixed(4)}` });
  checks.push({
    name: 'Valid baseline steady state (adoption 0)',
    pass: atZero.ok,
    detail: atZero.ok
      ? `converged analytically; Euler residual ${atZero.diagnostics.eulerResidual.toExponential(1)}`
      : atZero.detail,
  });
  if (atZero.ok) {
    const s = atZero;
    const d = s.diagnostics;
    checks.push({
      name: 'Accounting identities at baseline (zero profit, C+I=Y, household budget)',
      pass:
        Math.abs(d.eulerResidual) < 1e-10 &&
        Math.abs(d.resourceResidual) < 1e-10 &&
        Math.abs(d.householdBudgetResidual) < 1e-10,
      detail: `${d.eulerResidual.toExponential(1)}, ${d.resourceResidual.toExponential(1)}, ${d.householdBudgetResidual.toExponential(1)}`,
    });
    moments.push(
      {
        name: 'Labour cost share of factor income',
        data: sL,
        model: s.diagnostics.labourCostShare,
        targeted: true,
        note: 'D1 × employed/employees ÷ (GDP − net production taxes)',
      },
      {
        name: 'Capital / factor-cost output',
        data: KYdata,
        model: s.levels.K / s.levels.Y,
        targeted: mode.kind === 'fromCapitalOutput',
        note:
          mode.kind === 'fixed'
            ? `untargeted: β fixed at ${mode.beta}`
            : 'Eurostat N11N current replacement cost',
      },
      {
        name: 'Hours share of time endowment',
        data: hoursShare,
        model: s.levels.L,
        targeted: true,
        note: 'hours per employed person ÷ assumed endowment',
      },
      {
        name: 'Investment / output',
        data: na.grossFixedCapitalFormation / factorOutput,
        model: s.levels.I / s.levels.Y,
        targeted: false,
        note: 'model is a no-growth steady state: replacement investment only',
      },
      {
        name: 'Consumption / output',
        data: consumption / factorOutput,
        model: s.levels.C / s.levels.Y,
        targeted: false,
        note: 'model C includes what government consumes in the data (lump-sum rebate)',
      },
      {
        name: 'SIF contributions (employee+employer) / factor output',
        data: NaN,
        model: s.government.ssTotal / s.levels.Y,
        targeted: false,
        note: 'no official SIF contribution figure after 2020 (data gap)',
      },
    );
  }
  return {
    params,
    derived: {
      labourCostShare: sL,
      capitalOutput: KY,
      Rk,
      deltaK,
      hoursShare,
      siInsurableShare: share,
      insurableShareMethod: method,
      earningsYear: earnings.year,
      taxes: { consumption: tauC, labour: tauL, capital: tauK, employerSS: tauSse, employeeSS: tauSsw },
    },
    steadyState: ss,
    moments,
    checks,
  };
}
