/**
 * Cyprus personal income tax: a progressive schedule applied to taxable income
 * (gross income minus allowable deductions). Bands come from the data file.
 */
import type { IncomeTaxBand, IncomeTaxRules } from './types';

export function validateBands(bands: readonly IncomeTaxBand[]): void {
  if (bands.length === 0) throw new RangeError('income tax schedule has no bands');
  if (bands[0]?.from !== 0) throw new RangeError('first band must start at 0');
  bands.forEach((b, i) => {
    const next = bands[i + 1];
    if (!(b.rate >= 0 && b.rate < 1)) throw new RangeError(`band ${i}: rate ${b.rate} outside [0,1)`);
    if (next) {
      if (b.to !== next.from)
        throw new RangeError(`band ${i} ends at ${b.to} but band ${i + 1} starts at ${next.from}`);
    } else if (b.to !== null) {
      throw new RangeError('top band must be open-ended (to = null)');
    }
    if (b.to !== null && !(b.to > b.from)) throw new RangeError(`band ${i} is empty or reversed`);
  });
}

/** Tax due on a given taxable income (€/year). Negative taxable income is treated as 0. */
export function progressiveTax(taxableIncome: number, bands: readonly IncomeTaxBand[]): number {
  const y = Math.max(0, taxableIncome);
  let tax = 0;
  for (const b of bands) {
    if (y <= b.from) break;
    const top = b.to === null ? y : Math.min(y, b.to);
    tax += (top - b.from) * b.rate;
  }
  return tax;
}

/** Statutory marginal rate at a taxable income (rate of the band containing it). */
export function marginalRate(taxableIncome: number, bands: readonly IncomeTaxBand[]): number {
  const y = Math.max(0, taxableIncome);
  for (const b of bands) if (b.to === null || y < b.to) return b.rate;
  return bands[bands.length - 1]?.rate ?? 0;
}

export interface IncomeTaxInput {
  readonly grossEmploymentIncome: number;
  /** Employee SI + GHS contributions paid (€/year), candidates for deduction. */
  readonly employeeContributions: number;
  /** Other allowable deductions supplied by the user (€/year); not inferred. */
  readonly otherDeductions?: number;
}

export interface IncomeTaxResult {
  readonly taxableIncome: number;
  readonly tax: number;
  readonly averageRateOnGross: number;
  readonly marginalRate: number;
  readonly contributionDeduction: number;
  /** True if the contribution deduction cap is unverified and the deduction was not applied. */
  readonly contributionDeductionUnverified: boolean;
}

export function incomeTax(input: IncomeTaxInput, rules: IncomeTaxRules): IncomeTaxResult {
  const gross = Math.max(0, input.grossEmploymentIncome);
  const cap = rules.contributionDeductionCapShare;
  const contributionDeduction = cap === null ? 0 : Math.min(input.employeeContributions, cap * gross);
  const taxableIncome = Math.max(0, gross - contributionDeduction - (input.otherDeductions ?? 0));
  const tax = progressiveTax(taxableIncome, rules.bands);
  return {
    taxableIncome,
    tax,
    averageRateOnGross: gross > 0 ? tax / gross : 0,
    marginalRate: marginalRate(taxableIncome, rules.bands),
    contributionDeduction,
    contributionDeductionUnverified: cap === null,
  };
}
