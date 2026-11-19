/**
 * Unified registry of SS-financing instruments: the paper's robot taxes (A–D) and the exploratory
 * policies E/F/G (docs/policies/POLICIES.md). E/F/G are NEW research hypotheses, not part of
 * Casas & Torres (2026); their revenue is earmarked for SS by construction of the comparison.
 */
import { neutralExcessProfitAllowance } from '../paper/households';
import type { PaperParameters, PolicyExtensions } from '../paper/types';
import {
  rateUpperBound,
  solveRequiredRateGeneric,
  withRobotTax,
  type RequiredTaxOptions,
  type RequiredTaxResult,
} from './robotTaxes';

export const ALL_SCHEMES = [
  'robotIncome',
  'robotInvestment',
  'robotSS',
  'valueAdded',
  'labourShare',
  'excessProfit',
] as const;
export type ActiveScheme = (typeof ALL_SCHEMES)[number];

export const POLICY_INFO: Record<
  ActiveScheme,
  { code: string; label: string; base: string; origin: 'paper' | 'exploratory' }
> = {
  robotIncome: { code: 'B', label: 'Autonomous-capital income tax', base: '(R_d − δ_d)·D', origin: 'paper' },
  robotInvestment: {
    code: 'C',
    label: 'Ad-valorem tax on autonomous-capital investment',
    base: 'I_d',
    origin: 'paper',
  },
  robotSS: {
    code: 'D',
    label: 'Employer SS contribution on autonomous capital',
    base: 'R_d·D',
    origin: 'paper',
  },
  valueAdded: {
    code: 'E',
    label: 'Contribution on corporate gross value added',
    base: 'c_E · GVA',
    origin: 'exploratory',
  },
  labourShare: {
    code: 'F',
    label: 'Labour-share-adjusted contribution',
    base: 'c_F · max(0, s̄·GVA − employee compensation)',
    origin: 'exploratory',
  },
  excessProfit: {
    code: 'G',
    label: 'Excess-economic-profit contribution',
    base: 'Σ (R − δ − r_n)⁺ · capital',
    origin: 'exploratory',
  },
};

export interface PolicyConfig {
  /** E: share of GVA liable (size thresholds, minimum VA and sector exemptions). */
  readonly valueAddedCoverage: number;
  /** F: benchmark labour share s̄ (employee compensation / GVA) and liable share of GVA. */
  readonly labourShareBenchmark: number;
  readonly labourShareCoverage: number;
  /** G: normal-return allowance r_n; 'neutral' = required pre-tax net return (zero-distortion design). */
  readonly excessProfitAllowance:
    'neutral' | { readonly fractionOfNeutral: number } | { readonly rate: number };
  /** Share ψ ∈ [0,1] of the employer SS rate replaced when the instrument is introduced (0 = supplement). */
  readonly payrollReplacement: number;
}

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  valueAddedCoverage: 1,
  labourShareBenchmark: 0.5,
  labourShareCoverage: 1,
  excessProfitAllowance: { fractionOfNeutral: 0.5 },
  payrollReplacement: 0,
};

export function excessProfitAllowance(p: PaperParameters, cfg: PolicyConfig): number {
  const a = cfg.excessProfitAllowance;
  const neutral = neutralExcessProfitAllowance(p);
  if (a === 'neutral') return neutral;
  return 'rate' in a ? a.rate : a.fractionOfNeutral * neutral;
}

/** Install exactly one instrument at rate τ (others removed), applying payroll replacement ψ. */
export function withPolicy(
  p: PaperParameters,
  scheme: ActiveScheme | 'none',
  rate: number,
  cfg: PolicyConfig = DEFAULT_POLICY_CONFIG,
): PaperParameters {
  const clean: PaperParameters = { ...withRobotTax(p, 'none', 0), extensions: {} };
  const psi = scheme === 'none' ? 0 : cfg.payrollReplacement;
  if (!(psi >= 0 && psi <= 1)) throw new RangeError('payrollReplacement must be in [0,1]');
  const base: PaperParameters = {
    ...clean,
    taxes: { ...clean.taxes, employerSS: p.taxes.employerSS * (1 - psi) },
  };
  if (scheme === 'none') return base;
  if (scheme === 'robotIncome' || scheme === 'robotInvestment' || scheme === 'robotSS')
    return withRobotTax(base, scheme, rate);
  const ext: PolicyExtensions =
    scheme === 'valueAdded'
      ? { valueAdded: { rate, coverage: cfg.valueAddedCoverage } }
      : scheme === 'labourShare'
        ? { labourShare: { rate, benchmark: cfg.labourShareBenchmark, coverage: cfg.labourShareCoverage } }
        : { excessProfit: { rate, normalReturn: excessProfitAllowance(p, cfg) } };
  return { ...base, extensions: ext };
}

export function policyRateUpperBound(
  p: PaperParameters,
  scheme: ActiveScheme,
  cfg: PolicyConfig = DEFAULT_POLICY_CONFIG,
): number {
  if (scheme === 'valueAdded') return 0.5;
  // Keep the labour-cost credit τ_F·c_F strictly below 100% (otherwise labour cost would be negative).
  if (scheme === 'labourShare') return Math.min(2, (1 - 1e-6) / Math.max(1e-12, cfg.labourShareCoverage));
  if (scheme === 'excessProfit') return 1 - p.taxes.capital - p.taxes.robotIncome - 1e-4;
  return rateUpperBound(p, scheme);
}

/** Smallest rate of `scheme` that restores SS/Y to the target (see solveRequiredRateGeneric). */
export function solveRequiredRate(
  p: PaperParameters,
  scheme: ActiveScheme,
  cfg: PolicyConfig = DEFAULT_POLICY_CONFIG,
  opts: RequiredTaxOptions = {},
): RequiredTaxResult {
  return solveRequiredRateGeneric(
    p,
    scheme,
    (q, tau) => withPolicy(q, scheme, tau, cfg),
    policyRateUpperBound(p, scheme),
    opts,
  );
}

/** Coverage of GVA after sector exemptions: 1 − Σ exempt sector GVA / total GVA. */
export function coverageAfterExemptions(
  sectorGva: Readonly<Record<string, number>>,
  totalGva: number,
  exempt: readonly string[],
): number {
  const exemptGva = exempt.reduce((s, k) => {
    const v = sectorGva[k];
    if (v === undefined) throw new RangeError(`unknown sector ${k}`);
    return s + v;
  }, 0);
  if (!(totalGva > 0 && exemptGva <= totalGva)) throw new RangeError('exempt GVA must not exceed total GVA');
  return 1 - exemptGva / totalGva;
}
