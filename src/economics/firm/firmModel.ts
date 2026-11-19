/**
 * Level 3: exploratory firm-level contribution simulator (docs/policies/POLICIES.md).
 *
 * This is NOT implied by the Casas–Torres model, and results are NOT aggregated to national revenue.
 * No firm-level micro-data bridge has been implemented or validated. Archetype firms are
 * explicitly hypothetical. Behavioural responses are partial-equilibrium, constant-elasticity
 * assumptions, not estimates.
 *
 * Existing statutory contributions come from the exact Cyprus payroll engine (unchanged statutory
 * rates; the macro model's calibrated effective rate is never used here).
 */
import { total, type EarningsInput } from '../cyprus/contributionRules';
import { employeeResult } from '../cyprus/employerCosts';
import type { CyprusStatutoryRules, Recipient } from '../cyprus/types';

export interface FirmEmployeeGroup {
  readonly label: string;
  readonly headcount: number;
  readonly earnings: EarningsInput;
}

export interface FirmInputs {
  readonly name: string;
  /** NACE Rev.2 section letter. */
  readonly sector: string;
  readonly hypothetical: true;
  /** Turnover (sales), € per year. NOT value added. */
  readonly revenue: number;
  /** Intermediate consumption incl. outsourced services, € per year. GVA = revenue − intermediate consumption. */
  readonly intermediateConsumption: number;
  /** Part of intermediate consumption that is outsourced labour (agency staff, contractors), €. */
  readonly outsourcedLabourCosts: number;
  readonly employees: readonly FirmEmployeeGroup[];
  readonly depreciation: number;
  /** Operating capital stock (book value), €. */
  readonly capitalStock: number;
  /** AI/automation-related investment in the year, € (eligible for G's investment allowance). */
  readonly aiInvestment: number;
  /** Tax losses brought forward, €. */
  readonly lossesBroughtForward: number;
  /** Share of profit the firm can shift abroad at most (international mobility), [0,1]. */
  readonly maxProfitShifting: number;
}

export interface FirmPolicyConfig {
  readonly valueAdded: {
    readonly rate: number;
    readonly minEmployees: number;
    readonly minGva: number;
    readonly exemptSectors: readonly string[];
    /** Elasticity of the reported GVA base w.r.t. the net-of-contribution rate (≥ 0). */
    readonly baseElasticity: number;
    /** Share of the employer SI rate replaced (0 = supplement). */
    readonly payrollReplacement: number;
  };
  readonly labourShare: {
    readonly rate: number;
    /** Benchmark labour share by sector (fallback 'default'). */
    readonly benchmarks: Readonly<Record<string, number>>;
    readonly minEmployees: number;
    /** Count this share of outsourced labour costs as labour (anti-avoidance; 0–1). */
    readonly outsourcingCountedAsLabour: number;
    /** Only firms with operating margin (EBIT / GVA) at or above this pay (profitability condition). */
    readonly minOperatingMargin: number;
    /** Cap: contribution ≤ this share of EBIT. */
    readonly capShareOfProfit: number;
    readonly baseElasticity: number;
  };
  readonly excessProfit: {
    readonly rate: number;
    /** Normal return allowed on the capital stock (fraction per year). */
    readonly normalReturn: number;
    /** Share of AI investment deductible immediately (eligible investment allowance), 0–1. */
    readonly investmentAllowance: number;
    readonly useLossCarryforward: boolean;
    /** Semi-elasticity of profit shifting: shifted share = min(maxProfitShifting, η × rate). */
    readonly shiftingSemiElasticity: number;
  };
}

export interface FirmAccounts {
  readonly revenue: number;
  readonly gva: number;
  readonly grossPayroll: number;
  /** Employee compensation (national-accounts concept): gross pay + employer statutory contributions. */
  readonly employeeCompensation: number;
  readonly labourShare: number;
  /** EBITDA = GVA − employee compensation. */
  readonly operatingSurplus: number;
  /** EBIT = EBITDA − depreciation. */
  readonly ebit: number;
  readonly operatingMargin: number;
  /** Statutory contributions by recipient (employee + employer + state), €. */
  readonly existingByRecipient: Readonly<Record<Recipient, number>>;
  readonly employerStatutory: number;
  readonly employeeStatutory: number;
  /** State SI/GHS contributions on this firm's payroll (paid by government, not the firm). */
  readonly stateContributions: number;
  /**
   * Non-insurable payroll, € and share of gross payroll: earnings above the per-period SI ceiling,
   * plus whole-euro rounding of insurable earnings (Reg. 8(4), at most €0.50 per period).
   */
  readonly payrollAboveSiCeiling: number;
  readonly shareAboveSiCeiling: number;
  /** Corporate income tax at the statutory rate on EBIT net of losses (illustrative). */
  readonly corporateTax: number;
}

export interface PolicyCharge {
  readonly liable: boolean;
  readonly reason: string;
  /** Base before behavioural response, €. */
  readonly staticBase: number;
  /** Base after the assumed behavioural response, €. */
  readonly base: number;
  readonly contribution: number;
  /** Employer SI saved through payroll replacement (E only), €. */
  readonly payrollRelief: number;
  readonly netChange: number;
}

const sumRecipients = (): Record<Recipient, number> => ({
  socialInsuranceFund: 0,
  healthInsuranceOrganisation: 0,
  socialCohesionFund: 0,
  redundancyFund: 0,
  hrdAuthority: 0,
  centralHolidayFund: 0,
  taxDepartment: 0,
});

export function validateFirm(f: FirmInputs): void {
  const nonNeg = [
    'revenue',
    'intermediateConsumption',
    'outsourcedLabourCosts',
    'depreciation',
    'capitalStock',
    'aiInvestment',
    'lossesBroughtForward',
  ] as const;
  for (const k of nonNeg)
    if (!(f[k] >= 0 && Number.isFinite(f[k]))) throw new RangeError(`${f.name}: ${k} must be ≥ 0`);
  if (f.intermediateConsumption > f.revenue)
    throw new RangeError(`${f.name}: intermediate consumption exceeds revenue (negative GVA)`);
  if (f.outsourcedLabourCosts > f.intermediateConsumption)
    throw new RangeError(`${f.name}: outsourced labour must be part of intermediate consumption`);
  if (!(f.maxProfitShifting >= 0 && f.maxProfitShifting <= 1))
    throw new RangeError(`${f.name}: maxProfitShifting must be in [0,1]`);
}

export function firmAccounts(f: FirmInputs, rules: CyprusStatutoryRules): FirmAccounts {
  validateFirm(f);
  const byRecipient = sumRecipients();
  let grossPayroll = 0;
  let employerStatutory = 0;
  let employeeStatutory = 0;
  let stateContributions = 0;
  let insurable = 0;
  for (const g of f.employees) {
    if (!(Number.isInteger(g.headcount) && g.headcount >= 0))
      throw new RangeError(`${f.name}: headcount must be a non-negative integer`);
    const r = employeeResult(g.earnings, rules);
    const n = g.headcount;
    grossPayroll += n * r.contributions.grossAnnual;
    insurable += n * r.contributions.siInsurableAnnual;
    employerStatutory += n * r.employerStatutory;
    employeeStatutory += n * (r.employeeSI + r.employeeGHS);
    stateContributions += n * total(r.contributions.lines, { payer: 'state' });
    for (const l of r.contributions.lines) byRecipient[l.recipient] += n * l.amount;
    byRecipient.taxDepartment += n * r.incomeTax.tax;
  }
  const gva = f.revenue - f.intermediateConsumption;
  const employeeCompensation = grossPayroll + employerStatutory;
  const operatingSurplus = gva - employeeCompensation;
  const ebit = operatingSurplus - f.depreciation;
  const corporateTax = rules.corporateTaxRate * Math.max(0, ebit - f.lossesBroughtForward);
  return {
    revenue: f.revenue,
    gva,
    grossPayroll,
    employeeCompensation,
    labourShare: gva > 0 ? employeeCompensation / gva : NaN,
    operatingSurplus,
    ebit,
    operatingMargin: gva > 0 ? ebit / gva : NaN,
    existingByRecipient: byRecipient,
    employerStatutory,
    employeeStatutory,
    stateContributions,
    payrollAboveSiCeiling: Math.max(0, grossPayroll - insurable),
    shareAboveSiCeiling: grossPayroll > 0 ? Math.max(0, grossPayroll - insurable) / grossPayroll : 0,
    corporateTax,
  };
}

const headcount = (f: FirmInputs) => f.employees.reduce((s, g) => s + g.headcount, 0);
/** Constant-elasticity response of a base to the net-of-contribution rate: B(τ) = B₀(1−τ)^ε. */
const respond = (base: number, rate: number, elasticity: number) =>
  base * Math.pow(Math.max(0, 1 - rate), elasticity);
const notLiable = (reason: string): PolicyCharge => ({
  liable: false,
  reason,
  staticBase: 0,
  base: 0,
  contribution: 0,
  payrollRelief: 0,
  netChange: 0,
});

/** Policy E: contribution on firm gross value added. */
export function valueAddedCharge(
  f: FirmInputs,
  a: FirmAccounts,
  cfg: FirmPolicyConfig['valueAdded'],
  rules: CyprusStatutoryRules,
): PolicyCharge {
  if (cfg.exemptSectors.includes(f.sector) || cfg.exemptSectors.includes(f.sector.charAt(0))) {
    return notLiable(`sector ${f.sector} exempt`);
  }
  if (headcount(f) < cfg.minEmployees) return notLiable(`below ${cfg.minEmployees} employees`);
  if (a.gva < cfg.minGva) return notLiable(`GVA below €${cfg.minGva}`);
  const base = respond(a.gva, cfg.rate, cfg.baseElasticity);
  const contribution = cfg.rate * base;
  const payrollRelief = cfg.payrollReplacement * employerSiOnly(f, rules);
  return {
    liable: true,
    reason: 'liable',
    staticBase: a.gva,
    base,
    contribution,
    payrollRelief,
    netChange: contribution - payrollRelief,
  };
}

function employerSiOnly(f: FirmInputs, rules: CyprusStatutoryRules): number {
  return f.employees.reduce(
    (s, g) =>
      s +
      g.headcount *
        total(employeeResult(g.earnings, rules).contributions.lines, { payer: 'employer', item: 'si' }),
    0,
  );
}

/** Policy F: labour-share-adjusted contribution. */
export function labourShareCharge(
  f: FirmInputs,
  a: FirmAccounts,
  cfg: FirmPolicyConfig['labourShare'],
): PolicyCharge {
  if (headcount(f) < cfg.minEmployees) return notLiable(`below ${cfg.minEmployees} employees`);
  if (!(a.gva > 0)) return notLiable('no positive GVA');
  if (a.operatingMargin < cfg.minOperatingMargin) {
    return notLiable(
      `operating margin ${(a.operatingMargin * 100).toFixed(1)}% below ${(cfg.minOperatingMargin * 100).toFixed(1)}% (profitability condition)`,
    );
  }
  // Most specific benchmark first: NACE division, then section, then the generic default.
  const benchmark =
    cfg.benchmarks[f.sector] ?? cfg.benchmarks[f.sector.charAt(0)] ?? cfg.benchmarks['default'];
  if (benchmark === undefined) throw new RangeError('no labour-share benchmark for sector and no default');
  const labour = a.employeeCompensation + cfg.outsourcingCountedAsLabour * f.outsourcedLabourCosts;
  const shortfall = Math.max(0, benchmark * a.gva - labour);
  if (shortfall === 0)
    return notLiable(
      `labour share ${((labour / a.gva) * 100).toFixed(1)}% ≥ benchmark ${(benchmark * 100).toFixed(1)}%`,
    );
  const base = respond(shortfall, cfg.rate, cfg.baseElasticity);
  const contribution = Math.min(cfg.rate * base, cfg.capShareOfProfit * Math.max(0, a.ebit));
  return {
    liable: true,
    reason: 'liable',
    staticBase: shortfall,
    base,
    contribution,
    payrollRelief: 0,
    netChange: contribution,
  };
}

/** Policy G: contribution on profit above a normal return on capital. */
export function excessProfitCharge(
  f: FirmInputs,
  a: FirmAccounts,
  cfg: FirmPolicyConfig['excessProfit'],
): PolicyCharge {
  const allowance = cfg.normalReturn * f.capitalStock + cfg.investmentAllowance * f.aiInvestment;
  const losses = cfg.useLossCarryforward ? f.lossesBroughtForward : 0;
  const staticBase = Math.max(0, a.ebit - allowance - losses);
  if (staticBase === 0) return notLiable('no profit above the normal return (after allowances and losses)');
  const shifted = Math.min(f.maxProfitShifting, cfg.shiftingSemiElasticity * cfg.rate);
  const base = staticBase * (1 - shifted);
  const contribution = cfg.rate * base;
  return {
    liable: true,
    reason: 'liable',
    staticBase,
    base,
    contribution,
    payrollRelief: 0,
    netChange: contribution,
  };
}

export interface FirmComparison {
  readonly firm: FirmInputs;
  readonly accounts: FirmAccounts;
  readonly valueAdded: PolicyCharge;
  readonly labourShare: PolicyCharge;
  readonly excessProfit: PolicyCharge;
}

export function compareFirm(
  f: FirmInputs,
  cfg: FirmPolicyConfig,
  rules: CyprusStatutoryRules,
): FirmComparison {
  const accounts = firmAccounts(f, rules);
  return {
    firm: f,
    accounts,
    valueAdded: valueAddedCharge(f, accounts, cfg.valueAdded, rules),
    labourShare: labourShareCharge(f, accounts, cfg.labourShare),
    excessProfit: excessProfitCharge(f, accounts, cfg.excessProfit),
  };
}
