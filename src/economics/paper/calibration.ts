/**
 * Paper calibration (Casas & Torres 2026, §4, Table 1) and runtime parameter validation.
 * These are the paper's values for an artificial OECD-average economy, NOT Cyprus values.
 */
import { z } from 'zod';
import { DEFAULT_VARIANT, type PaperParameters, type TaxRates, type Technology } from './types';

export const PAPER_PRESET_ID = 'casas-torres-2026-table1';

/** Table 1, "Traditional taxes"; robot taxes are "Free" (solved for) and default to 0. */
export const PAPER_TAXES: TaxRates = {
  consumption: 0.1832,
  labour: 0.1646,
  employerSS: 0.1589,
  employeeSS: 0.0945,
  capital: 0.2418,
  robotIncome: 0,
  robotInvestment: 0,
  robotSS: 0,
};

/**
 * Smallest positive adoption accepted. Below this the robot demand D ∝ φ^υ underflows double
 * precision; 0 itself (no automation) is allowed and handled exactly.
 */
export const MIN_POSITIVE_ADOPTION = 1e-9;

/** Adoption range explored in the paper: φ, μ ∈ [0, 0.45]. */
export const PAPER_ADOPTION_RANGE = [0, 0.45] as const;

export function paperParameters(
  technology: Technology,
  overrides: Partial<PaperParameters> = {},
): PaperParameters {
  return {
    technology,
    beta: 0.975,
    gamma: 0.4,
    deltaK: 0.06,
    deltaD: 0.2,
    capitalShareParam: 0.35,
    elasticityKL: 0.9,
    elasticityAuto: 2,
    adoption: 0,
    taxes: PAPER_TAXES,
    variant: DEFAULT_VARIANT,
    ...overrides,
  };
}

const unit = (open = false) =>
  open ? z.number().gt(0).lt(1) : z.number().min(0).lt(1, { message: 'must be < 1' });

const taxSchema = z.object({
  consumption: z.number().min(0).max(1),
  labour: z.number().min(0).lt(1),
  employerSS: z.number().min(0).max(2),
  employeeSS: z.number().min(0).lt(1),
  capital: z.number().min(0).lt(1),
  robotIncome: z.number().min(0).lt(1),
  robotInvestment: z.number().min(0).max(10),
  robotSS: z.number().min(0).max(10),
});

export const paperParametersSchema = z
  .object({
    technology: z.enum(['A', 'B']),
    beta: unit(true),
    gamma: unit(true),
    deltaK: z.number().gt(0).lte(1),
    deltaD: z.number().gt(0).lte(1),
    capitalShareParam: unit(true),
    elasticityKL: z.number().gt(0).lte(50),
    elasticityAuto: z.number().gt(0).lte(50),
    adoption: unit(),
    taxes: taxSchema,
    variant: z.object({
      techAWeight: z.enum(['capitalWeight', 'asPrinted']),
      labourSupply: z.enum(['asPrinted', 'figureReplication']),
    }),
  })
  .refine((p) => p.adoption === 0 || p.adoption >= MIN_POSITIVE_ADOPTION, {
    message: `adoption must be 0 or ≥ ${MIN_POSITIVE_ADOPTION} (smaller weights underflow robot demand)`,
  })
  .refine((p) => p.taxes.labour + p.taxes.employeeSS < 1, {
    message: 'τl + τssw must be < 1 (net wage must be positive)',
  })
  .refine((p) => p.taxes.capital + p.taxes.robotIncome < 1, {
    message: 'τk + τd must be < 1 (eq. 26 denominator)',
  });

export function validatePaperParameters(p: unknown): PaperParameters {
  return paperParametersSchema.parse(p);
}
