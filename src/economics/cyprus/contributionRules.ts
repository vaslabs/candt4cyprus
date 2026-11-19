/**
 * Cyprus payroll contributions for one person, computed from their pay-period earnings.
 *
 * Accounting rules enforced here (prompt PART 2 A):
 *  - SI ceilings apply per person and per pay period, never once to a firm's total payroll.
 *  - Employee, employer and state SI contributions are separate lines; the state contribution is
 *    paid by government and is NOT part of the employer's labour cost.
 *  - GHS, Social Cohesion, Redundancy, HRD and Central Holiday contributions are separate lines
 *    with their own recipients; none of them is Social Insurance Fund revenue.
 */
import type { ContributionLine, CyprusStatutoryRules, Recipient } from './types';

export interface EmployeeEarnings {
  /** Gross earnings in each pay period (€). One entry per period actually paid. */
  readonly periodEarnings: readonly number[];
  readonly periodType: 'monthly' | 'weekly';
  /** Whether the employer pays into the Central Holiday Fund for this employee. */
  readonly centralHolidayFund?: boolean;
}

export interface ContributionBreakdown {
  readonly grossAnnual: number;
  /** Sum over periods of min(period earnings, SI period ceiling). */
  readonly siInsurableAnnual: number;
  readonly ghsBaseAnnual: number;
  readonly lines: readonly ContributionLine[];
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

export function siPeriodCeiling(rules: CyprusStatutoryRules, periodType: 'monthly' | 'weekly'): number {
  const c = rules.socialInsurance.ceilingPerPeriod[periodType];
  if (c === null) throw new RangeError(`no verified SI ceiling for ${periodType} pay periods`);
  return c;
}

function assertEarnings(e: EmployeeEarnings): void {
  for (const x of e.periodEarnings) {
    if (!(x >= 0 && Number.isFinite(x)))
      throw new RangeError(`period earnings must be finite and ≥ 0, got ${x}`);
  }
}

export function employeeContributions(
  e: EmployeeEarnings,
  rules: CyprusStatutoryRules,
): ContributionBreakdown {
  assertEarnings(e);
  const ceiling = siPeriodCeiling(rules, e.periodType);
  const grossAnnual = sum(e.periodEarnings);
  const siInsurableAnnual = sum(e.periodEarnings.map((x) => Math.min(x, ceiling)));
  const ghsBaseAnnual = Math.min(grossAnnual, rules.ghs.annualCeiling);
  const si = rules.socialInsurance;
  const g = rules.ghs;
  const f = rules.employerFunds;
  const line = (
    item: ContributionLine['item'],
    payer: ContributionLine['payer'],
    recipient: Recipient,
    base: number,
    rate: number,
  ): ContributionLine => ({ item, payer, recipient, base, rate, amount: base * rate });
  const fundBase = (b: 'none' | 'siCeiling') => (b === 'none' ? grossAnnual : siInsurableAnnual);

  const lines: ContributionLine[] = [
    line('si', 'employee', 'socialInsuranceFund', siInsurableAnnual, si.employeeRate),
    line('si', 'employer', 'socialInsuranceFund', siInsurableAnnual, si.employerRate),
    line('si', 'state', 'socialInsuranceFund', siInsurableAnnual, si.stateRate),
    line('ghs', 'employee', 'healthInsuranceOrganisation', ghsBaseAnnual, g.employeeRate),
    line('ghs', 'employer', 'healthInsuranceOrganisation', ghsBaseAnnual, g.employerRate),
    line(
      'socialCohesion',
      'employer',
      f.socialCohesion.recipient,
      fundBase(f.socialCohesion.base),
      f.socialCohesion.rate,
    ),
    line('redundancy', 'employer', f.redundancy.recipient, fundBase(f.redundancy.base), f.redundancy.rate),
    line('hrd', 'employer', f.hrd.recipient, fundBase(f.hrd.base), f.hrd.rate),
  ];
  if (g.stateRate !== null)
    lines.push(line('ghs', 'state', 'healthInsuranceOrganisation', ghsBaseAnnual, g.stateRate));
  if (e.centralHolidayFund) {
    lines.push(
      line(
        'centralHoliday',
        'employer',
        f.centralHoliday.recipient,
        fundBase(f.centralHoliday.base),
        f.centralHoliday.rate,
      ),
    );
  }
  return { grossAnnual, siInsurableAnnual, ghsBaseAnnual, lines };
}

/** Self-employed SI and GHS on declared insurable income (annual basis). */
export function selfEmployedContributions(
  insurableIncome: number,
  rules: CyprusStatutoryRules,
): ContributionBreakdown {
  if (!(insurableIncome >= 0 && Number.isFinite(insurableIncome))) throw new RangeError('income must be ≥ 0');
  // Self-employed insurable income is weekly-based: maximum = 52 × weekly ceiling when published.
  const weekly = rules.socialInsurance.ceilingPerPeriod.weekly;
  const siBase = Math.min(
    insurableIncome,
    weekly === null ? rules.socialInsurance.annualCeiling : 52 * weekly,
  );
  const ghsBase = Math.min(insurableIncome, rules.ghs.annualCeiling);
  const si = rules.socialInsurance;
  return {
    grossAnnual: insurableIncome,
    siInsurableAnnual: siBase,
    ghsBaseAnnual: ghsBase,
    lines: [
      {
        item: 'si',
        payer: 'selfEmployed',
        recipient: 'socialInsuranceFund',
        base: siBase,
        rate: si.selfEmployedRate,
        amount: siBase * si.selfEmployedRate,
      },
      {
        item: 'si',
        payer: 'state',
        recipient: 'socialInsuranceFund',
        base: siBase,
        rate: si.stateRateSelfEmployed,
        amount: siBase * si.stateRateSelfEmployed,
      },
      {
        item: 'ghs',
        payer: 'selfEmployed',
        recipient: 'healthInsuranceOrganisation',
        base: ghsBase,
        rate: rules.ghs.selfEmployedRate,
        amount: ghsBase * rules.ghs.selfEmployedRate,
      },
      {
        item: 'hrd',
        payer: 'selfEmployed',
        recipient: 'hrdAuthority',
        base: siBase,
        rate: rules.employerFunds.hrdSelfEmployedRate,
        amount: siBase * rules.employerFunds.hrdSelfEmployedRate,
      },
    ],
  };
}

/** Total of lines matching a filter. */
export function total(
  lines: readonly ContributionLine[],
  filter: { payer?: ContributionLine['payer']; recipient?: Recipient; item?: ContributionLine['item'] } = {},
): number {
  return sum(
    lines
      .filter((l) => (filter.payer ? l.payer === filter.payer : true))
      .filter((l) => (filter.recipient ? l.recipient === filter.recipient : true))
      .filter((l) => (filter.item ? l.item === filter.item : true))
      .map((l) => l.amount),
  );
}
