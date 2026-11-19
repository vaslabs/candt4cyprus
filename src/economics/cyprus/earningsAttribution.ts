/**
 * Earning-period attribution of multi-period payments (13th salary, commissions, bonuses, arrears),
 * per the Social Insurance (Contributions) Regulations 2010, Κ.Δ.Π. 289/2010, Reg. 8(3)–(4):
 *
 *   «Το ποσό οποιασδήποτε προμήθειας, δέκατου τρίτου μισθού ή οποιωνδήποτε άλλων αποδοχών που
 *   αναφέρονται σε χρονικό διάστημα μεγαλύτερο της μιας περιόδου εισφοράς διαιρείται διά του αριθμού
 *   των περιόδων εισφοράς … Νοείται ότι, το άθροισμα των αποδοχών αυτών και των τυχόν αποδοχών για τις
 *   οποίες καταβλήθηκαν εισφορές για την αντίστοιχη περίοδο εισφοράς, δεν μπορεί να υπερβαίνει το
 *   ανώτατο όριο ασφαλιστέων αποδοχών.»
 *
 * Algorithm (verified): share s = A/N over the N periods the payment relates to; in each period the
 * insurable addition is min(s, max(0, C − already insured)), and unused room is NOT carried to
 * other periods. Insurable earnings per period are rounded to the nearest euro (Reg. 8(4)).
 *
 * PROVISIONAL elements (no authoritative text found; see docs/cyprus/DATA_GAPS.md):
 *  - prorated 13th salary: the divisor is the number of periods actually employed;
 *  - one-off bonuses not tied to a span: attributed to the payment period only;
 *  - payments after employment ends: attributed to the periods they relate to (arrears), or to the
 *    last period of employment when no span is identifiable;
 *  - each period uses the current year's ceiling (prior-year periods may legally use the old one).
 */
export type PaymentKind =
  'thirteenthSalary' | 'thirteenthSalaryProrated' | 'commission' | 'bonus' | 'arrears' | 'postTermination';

export interface MultiPeriodPayment {
  readonly kind: PaymentKind;
  readonly amount: number;
  /** Indices of the contribution periods the payment relates to (0-based, within `regular`). */
  readonly periods: readonly number[];
}

export interface AttributedEarnings {
  readonly attribution: 'earning-period';
  readonly periodType: 'monthly' | 'weekly';
  /** Regular earnings in each contribution period of the year (€). */
  readonly regular: readonly number[];
  readonly payments?: readonly MultiPeriodPayment[];
  readonly centralHolidayFund?: boolean;
  /** Round insurable earnings per period to the nearest euro (Reg. 8(4)). Default true. */
  readonly roundToEuro?: boolean;
}

export const PAYMENT_STATUS: Record<PaymentKind, { status: 'verified' | 'provisional'; basis: string }> = {
  thirteenthSalary: { status: 'verified', basis: "Κ.Δ.Π. 289/2010 Reg. 8(3); SIS Employer's Guide p. 3" },
  commission: { status: 'verified', basis: 'Κ.Δ.Π. 289/2010 Reg. 8(3) names commissions explicitly' },
  thirteenthSalaryProrated: {
    status: 'provisional',
    basis: 'Reg. 8(3) read literally: divisor = periods of service; no explicit text',
  },
  bonus: {
    status: 'provisional',
    basis:
      'Multi-period bonuses fall under "any other earnings" (Reg. 8(3)); one-off bonuses: payment period assumed',
  },
  arrears: {
    status: 'provisional',
    basis: 'Inferred from Reg. 8(3): attributed to the periods they relate to',
  },
  postTermination: {
    status: 'provisional',
    basis: 'No official text found; attributed to the related periods or the last period of employment',
  },
};

export interface AttributionResult {
  readonly grossAnnual: number;
  readonly insurablePerPeriod: readonly number[];
  readonly siInsurableAnnual: number;
  /** Per payment: insurable part and the non-insurable remainder. */
  readonly payments: readonly {
    readonly kind: PaymentKind;
    readonly amount: number;
    readonly insurable: number;
    readonly status: 'verified' | 'provisional';
  }[];
  readonly provisional: boolean;
}

export function attributeEarnings(e: AttributedEarnings, ceiling: number): AttributionResult {
  const n = e.regular.length;
  for (const x of e.regular)
    if (!(x >= 0 && Number.isFinite(x)))
      throw new RangeError(`regular earnings must be finite and ≥ 0, got ${x}`);
  const round = e.roundToEuro ?? true;
  const r = (x: number) => (round ? Math.round(x) : x);
  const assessed = e.regular.map((x) => Math.min(x, ceiling));
  const payments: AttributionResult['payments'][number][] = [];
  let gross = e.regular.reduce((a, b) => a + b, 0);
  for (const pmt of e.payments ?? []) {
    if (!(pmt.amount >= 0 && Number.isFinite(pmt.amount))) throw new RangeError(`payment amount must be ≥ 0`);
    if (pmt.periods.length === 0)
      throw new RangeError(`${pmt.kind}: a payment must relate to at least one period`);
    if (new Set(pmt.periods).size !== pmt.periods.length)
      throw new RangeError(`${pmt.kind}: duplicate periods`);
    for (const i of pmt.periods)
      if (!(Number.isInteger(i) && i >= 0 && i < n))
        throw new RangeError(`${pmt.kind}: period ${i} outside 0..${n - 1}`);
    gross += pmt.amount;
    const share = pmt.amount / pmt.periods.length;
    let insurable = 0;
    for (const i of pmt.periods) {
      const add = Math.min(share, Math.max(0, ceiling - (assessed[i] ?? 0)));
      assessed[i] = (assessed[i] ?? 0) + add;
      insurable += add;
    }
    payments.push({ kind: pmt.kind, amount: pmt.amount, insurable, status: PAYMENT_STATUS[pmt.kind].status });
  }
  const perPeriod = assessed.map(r);
  return {
    grossAnnual: gross,
    insurablePerPeriod: perPeriod,
    siInsurableAnnual: perPeriod.reduce((a, b) => a + b, 0),
    payments,
    provisional: payments.some((p) => p.status === 'provisional'),
  };
}

/** Annual salary over 12 months plus a 13th salary attributed to the months it relates to. */
export function salaryWith13th(
  annualRegular: number,
  opts: { monthsEmployed?: number; thirteenth?: 'full' | 'none' } = {},
): AttributedEarnings {
  const months = opts.monthsEmployed ?? 12;
  if (!(Number.isInteger(months) && months >= 1 && months <= 12))
    throw new RangeError('monthsEmployed must be 1..12');
  const monthly = annualRegular / 12;
  const regular = Array.from({ length: 12 }, (_, i) => (i < months ? monthly : 0));
  const payments: MultiPeriodPayment[] =
    opts.thirteenth === 'none'
      ? []
      : [
          {
            kind: months === 12 ? 'thirteenthSalary' : 'thirteenthSalaryProrated',
            amount: (monthly * months) / 12,
            periods: Array.from({ length: months }, (_, i) => i),
          },
        ];
  return { attribution: 'earning-period', periodType: 'monthly', regular, payments };
}
