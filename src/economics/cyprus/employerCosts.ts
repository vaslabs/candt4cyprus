/**
 * Employer labour cost and firm payroll aggregation.
 *
 * A firm's statutory contributions are the SUM over employees of each employee's capped
 * contributions. The SI ceiling is never applied to the firm's total payroll.
 */
import {
  employeeContributions,
  total,
  type ContributionBreakdown,
  type EmployeeEarnings,
} from './contributionRules';
import { incomeTax, type IncomeTaxResult } from './incomeTax';
import type { CyprusStatutoryRules, Recipient } from './types';

export interface EmployeeResult {
  readonly contributions: ContributionBreakdown;
  readonly incomeTax: IncomeTaxResult;
  readonly employeeSI: number;
  readonly employeeGHS: number;
  readonly employerStatutory: number;
  /** Gross pay + employer contributions (excludes the state SI/GHS contribution). */
  readonly employerLabourCost: number;
  readonly netPay: number;
}

export function employeeResult(
  e: EmployeeEarnings,
  rules: CyprusStatutoryRules,
  otherDeductions = 0,
): EmployeeResult {
  const c = employeeContributions(e, rules);
  const employeeSI = total(c.lines, { payer: 'employee', item: 'si' });
  const employeeGHS = total(c.lines, { payer: 'employee', item: 'ghs' });
  const employerStatutory = total(c.lines, { payer: 'employer' });
  const tax = incomeTax(
    {
      grossEmploymentIncome: c.grossAnnual,
      employeeContributions: employeeSI + employeeGHS,
      otherDeductions,
    },
    rules.incomeTax,
  );
  return {
    contributions: c,
    incomeTax: tax,
    employeeSI,
    employeeGHS,
    employerStatutory,
    employerLabourCost: c.grossAnnual + employerStatutory,
    netPay: c.grossAnnual - employeeSI - employeeGHS - tax.tax,
  };
}

export interface PayrollGroup {
  /** Number of employees with this earnings pattern. */
  readonly headcount: number;
  readonly earnings: EmployeeEarnings;
}

export interface PayrollResult {
  readonly headcount: number;
  readonly grossPayroll: number;
  readonly employerLabourCost: number;
  /** € per year by recipient, summed over all employees (all payers). */
  readonly byRecipient: Readonly<Record<Recipient, number>>;
  /** Social Insurance Fund receipts split by payer. */
  readonly socialInsuranceFund: {
    readonly employee: number;
    readonly employer: number;
    readonly state: number;
  };
  readonly incomeTax: number;
}

export function payroll(groups: readonly PayrollGroup[], rules: CyprusStatutoryRules): PayrollResult {
  const byRecipient: Record<Recipient, number> = {
    socialInsuranceFund: 0,
    healthInsuranceOrganisation: 0,
    socialCohesionFund: 0,
    redundancyFund: 0,
    hrdAuthority: 0,
    centralHolidayFund: 0,
    taxDepartment: 0,
  };
  let headcount = 0;
  let grossPayroll = 0;
  let employerLabourCost = 0;
  const sif = { employee: 0, employer: 0, state: 0 };
  for (const g of groups) {
    if (!(Number.isInteger(g.headcount) && g.headcount >= 0))
      throw new RangeError('headcount must be a non-negative integer');
    const r = employeeResult(g.earnings, rules);
    headcount += g.headcount;
    grossPayroll += g.headcount * r.contributions.grossAnnual;
    employerLabourCost += g.headcount * r.employerLabourCost;
    for (const l of r.contributions.lines) byRecipient[l.recipient] += g.headcount * l.amount;
    byRecipient.taxDepartment += g.headcount * r.incomeTax.tax;
    sif.employee +=
      g.headcount * total(r.contributions.lines, { recipient: 'socialInsuranceFund', payer: 'employee' });
    sif.employer +=
      g.headcount * total(r.contributions.lines, { recipient: 'socialInsuranceFund', payer: 'employer' });
    sif.state +=
      g.headcount * total(r.contributions.lines, { recipient: 'socialInsuranceFund', payer: 'state' });
  }
  return {
    headcount,
    grossPayroll,
    employerLabourCost,
    byRecipient,
    socialInsuranceFund: sif,
    incomeTax: byRecipient.taxDepartment,
  };
}

/** Equal monthly salary schedule: annual salary over 12 or 13 payments (13th as its own period). */
export function salarySchedule(annualSalary: number, payments: 12 | 13 = 12): EmployeeEarnings {
  return {
    periodType: 'monthly',
    periodEarnings: Array.from({ length: payments }, () => annualSalary / payments),
  };
}
