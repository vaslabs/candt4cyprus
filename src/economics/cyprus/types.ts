/**
 * Cyprus statutory rules (Level 2/3 inputs). These are legal rules applied to individual
 * earnings, deliberately separate from the macroeconomic equilibrium model: statutory rates
 * are NOT the paper's effective tax rates (see docs/MODEL_DEVIATIONS.md, Cyprus section).
 *
 * Money is in euro (€), per year unless a field says otherwise.
 */

/** Bodies that receive each payment; used to keep fund accounting separate (no double-counting). */
export type Recipient =
  | 'socialInsuranceFund'
  | 'healthInsuranceOrganisation' // GHS / GeSY
  | 'socialCohesionFund'
  | 'redundancyFund'
  | 'hrdAuthority'
  | 'centralHolidayFund'
  | 'taxDepartment';

export type Payer = 'employee' | 'employer' | 'state' | 'selfEmployed';

export interface SocialInsuranceRules {
  readonly employeeRate: number;
  readonly employerRate: number;
  /** State contribution on insurable earnings, paid by government to the Fund (not an employer cost). */
  readonly stateRate: number;
  readonly selfEmployedRate: number;
  /** State contribution rate on self-employed insurable income. */
  readonly stateRateSelfEmployed: number;
  /** Maximum insurable earnings per pay period, by period type (€). */
  readonly ceilingPerPeriod: { readonly monthly: number; readonly weekly: number | null };
  /** Maximum insurable earnings per year (€), for reference/annual checks. */
  readonly annualCeiling: number;
}

export interface GhsRules {
  readonly employeeRate: number;
  readonly employerRate: number;
  /** State contribution rate on employee earnings (paid by government). null if not verified. */
  readonly stateRate: number | null;
  readonly selfEmployedRate: number;
  /** Annual ceiling on income subject to GHS contributions (€). */
  readonly annualCeiling: number;
}

export interface EmployerFundRule {
  readonly rate: number;
  /** 'siCeiling' caps the base at the SI maximum insurable earnings per period; 'none' = all emoluments. */
  readonly base: 'none' | 'siCeiling';
  readonly recipient: Recipient;
}

export interface EmployerFundRules {
  readonly socialCohesion: EmployerFundRule;
  readonly redundancy: EmployerFundRule;
  readonly hrd: EmployerFundRule;
  /** Central Holiday Fund: applies only to employers not exempted (optional per employee). */
  readonly centralHoliday: EmployerFundRule;
  /** HRD levy paid by the self-employed on insurable income (new from 5/1/2026). */
  readonly hrdSelfEmployedRate: number;
}

export interface IncomeTaxBand {
  /** Lower bound of taxable income for this band (€/year). */
  readonly from: number;
  /** Upper bound (exclusive), or null for the top band. */
  readonly to: number | null;
  readonly rate: number;
}

export interface IncomeTaxRules {
  readonly bands: readonly IncomeTaxBand[];
  /**
   * Employee SI and GHS contributions deductible from taxable income, up to this share of
   * gross income (combined cap with other qualifying items). null = cap not verified; the
   * deduction is then not applied and the result is flagged.
   */
  readonly contributionDeductionCapShare: number | null;
}

export interface CyprusStatutoryRules {
  readonly year: number;
  readonly socialInsurance: SocialInsuranceRules;
  readonly ghs: GhsRules;
  readonly employerFunds: EmployerFundRules;
  readonly incomeTax: IncomeTaxRules;
  readonly corporateTaxRate: number;
  readonly vatStandardRate: number;
}

/** One line of a contribution breakdown, tagged with payer and recipient. */
export interface ContributionLine {
  readonly item: 'si' | 'ghs' | 'socialCohesion' | 'redundancy' | 'hrd' | 'centralHoliday' | 'incomeTax';
  readonly payer: Payer;
  readonly recipient: Recipient;
  /** € per year. */
  readonly amount: number;
  /** The base the rate was applied to (€ per year). */
  readonly base: number;
  readonly rate: number;
}
