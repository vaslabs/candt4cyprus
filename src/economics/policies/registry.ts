/**
 * Unified registry of SS-financing instruments: the paper's robot taxes (A–D) and the exploratory
 * policies E/F/G (docs/policies/POLICIES.md). E/F/G are NEW research hypotheses, not part of
 * Casas & Torres (2026); their revenue is earmarked for SS by construction of the comparison.
 */
import { neutralAllowances } from '../paper/households';
import type { PaperParameters, PolicyExtensions } from '../paper/types';
import { DEFAULT_POLICY_CONFIG, type PolicyConfig } from './config';
export { DEFAULT_POLICY_CONFIG, type PolicyConfig } from './config';
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
  'capitalReturnLevy',
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
    label: "Excess-economic-profit contribution (neutral allowance = each capital's required return)",
    base: 'Σ (R − δ − r_n)⁺ · capital + pure rents Π',
    origin: 'exploratory',
  },
  capitalReturnLevy: {
    code: 'G′',
    label: 'Reduced-allowance capital-return levy (NOT a neutral excess-profit tax)',
    base: 'Σ (R − δ − f·r_n)⁺ · capital, f < 1 (taxes part of the ordinary return)',
    origin: 'exploratory',
  },
};

export function excessProfitAllowances(
  p: PaperParameters,
  scheme: 'excessProfit' | 'capitalReturnLevy',
  cfg: PolicyConfig,
): { K: number; D: number } {
  const neutral = neutralAllowances(p);
  if (scheme === 'capitalReturnLevy') {
    const f = cfg.capitalReturnLevyFraction;
    if (!(f >= 0 && f < 1)) throw new RangeError('capitalReturnLevyFraction must be in [0, 1)');
    return { K: f * neutral.K, D: f * neutral.D };
  }
  const a = cfg.excessProfitAllowance;
  return a === 'neutral' ? neutral : { K: a.rate, D: a.rate };
}

/** Install exactly one instrument at rate τ (others removed), applying payroll replacement ψ. */
export function withPolicy(
  p: PaperParameters,
  scheme: ActiveScheme | 'none',
  rate: number,
  cfg: PolicyConfig = DEFAULT_POLICY_CONFIG,
): PaperParameters {
  // Keep model-variant extensions (the rents scenario); remove every policy instrument.
  const rents = p.extensions?.rents;
  const clean: PaperParameters = { ...withRobotTax(p, 'none', 0), extensions: rents ? { rents } : {} };
  const psi = scheme === 'none' ? 0 : cfg.payrollReplacement;
  if (!(psi >= 0 && psi <= 1)) throw new RangeError('payrollReplacement must be in [0,1]');
  const base: PaperParameters = {
    ...clean,
    taxes: { ...clean.taxes, employerSS: p.taxes.employerSS * (1 - psi) },
  };
  if (scheme === 'none') return base;
  if (scheme === 'robotIncome' || scheme === 'robotInvestment' || scheme === 'robotSS')
    return withRobotTax(base, scheme, rate);
  let ext: PolicyExtensions;
  if (scheme === 'valueAdded') ext = { valueAdded: { rate, coverage: cfg.valueAddedCoverage } };
  else if (scheme === 'labourShare') {
    ext = { labourShare: { rate, benchmark: cfg.labourShareBenchmark, coverage: cfg.labourShareCoverage } };
  } else {
    const a = excessProfitAllowances(p, scheme, cfg);
    ext = { excessProfit: { rate, normalReturn: a.K, normalReturnD: a.D } };
  }
  return { ...base, extensions: { ...base.extensions, ...ext } };
}

export function policyRateUpperBound(
  p: PaperParameters,
  scheme: ActiveScheme,
  cfg: PolicyConfig = DEFAULT_POLICY_CONFIG,
): number {
  if (scheme === 'valueAdded') return 0.5;
  // Keep the labour-cost credit τ_F·c_F strictly below 100% (otherwise labour cost would be negative).
  if (scheme === 'labourShare') return Math.min(2, (1 - 1e-6) / Math.max(1e-12, cfg.labourShareCoverage));
  if (scheme === 'excessProfit' || scheme === 'capitalReturnLevy')
    return 1 - p.taxes.capital - p.taxes.robotIncome - 1e-4;
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
