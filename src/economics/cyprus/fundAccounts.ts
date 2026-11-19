/**
 * Social Insurance Fund historical accounts (observed data; never simulated).
 *
 * Source: Social Insurance Services statistical bulletins, "Final accounts of the Social Insurance
 * Fund" (€000), Greek and English editions, extracted by tools/sis/extract_bulletins.py into
 * src/data/sifAccountsEditions.json. The authoritative value for a year is taken from the LATEST
 * Greek edition that contains it; every earlier edition is kept as revision history.
 */
import editionsJson from '../../data/sifAccountsEditions.json';
import { z } from 'zod';

export const FUND_ITEMS = [
  'reserveOpening',
  'privateEmployees',
  'publicEmployees',
  'selfEmployed',
  'voluntary',
  'state',
  'interest',
  'otherIncome',
  'totalIncome',
  'pensions',
  'otherBenefits',
  'medical',
  'admin',
  'totalExpenditure',
  'balance',
  'reserveClosing',
] as const;
export type FundItem = (typeof FUND_ITEMS)[number];

const editionSchema = z.object({
  id: z.string(),
  language: z.enum(['el', 'en']),
  edition: z.string(),
  url: z.url(),
  fileName: z.string(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  years: z.array(z.string().regex(/^20\d\d$/)),
  preliminary: z.array(z.string()),
  rows: z.record(z.enum(FUND_ITEMS), z.record(z.string(), z.number().int())),
});
const docSchema = z.object({ units: z.literal('€ thousand'), editions: z.array(editionSchema).min(1) });
export type FundEdition = z.infer<typeof editionSchema>;

/** Editions in publication order (January before July within a year). */
export function fundEditions(): FundEdition[] {
  const doc = docSchema.parse(editionsJson);
  const key = (e: FundEdition) => {
    const [month, year] = e.edition.split(' ');
    return Number(year) * 2 + (month === 'July' ? 1 : 0);
  };
  return [...doc.editions].sort((a, b) => key(a) - key(b) || a.language.localeCompare(b.language));
}

/** One year of Fund accounts in € million, with explicit availability of breakdowns. */
export interface FundYear {
  readonly year: number;
  readonly preliminary: boolean;
  readonly editionId: string;
  readonly sourceUrl: string;
  readonly receipts: {
    /** Employee + employer contributions; the split between them is NOT published. */
    readonly employedPrivate: number;
    readonly employedPublic: number;
    readonly employeeEmployerSplit: 'unavailable';
    readonly selfEmployed: number;
    readonly voluntary: number;
    /** General government contribution (the state's statutory share), a transfer from the budget. */
    readonly state: number;
    readonly interest: number;
    readonly other: number;
    readonly total: number;
  };
  readonly expenditure: {
    /** Pensions combined; breakdown by type (old-age/survivors/invalidity) NOT published here. */
    readonly pensions: number;
    readonly pensionsByType: 'unavailable';
    readonly otherBenefits: number;
    readonly medical: number;
    readonly administrative: number;
    readonly total: number;
  };
  readonly balance: number;
  readonly reserveOpening: number;
  readonly reserveClosing: number;
  /**
   * The reserve is an accounting balance held overwhelmingly as non-tradeable deposits with the
   * government (ILO 2020: 98.6%). It is NOT an unrestricted liquid investment portfolio, and it is
   * a different concept from the disputed "state obligation to the Fund".
   */
  readonly reserveNature: 'accounting-reserve-deposited-with-government';
}

const M = (x: number) => x / 1000;

/** Authoritative series: latest Greek edition per year. */
export function fundSeries(): FundYear[] {
  const eds = fundEditions().filter((e) => e.language === 'el');
  const byYear = new Map<string, FundEdition>();
  for (const e of eds) for (const y of e.years) byYear.set(y, e); // later editions overwrite
  return [...byYear.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([y, e]) => {
      const v = (k: FundItem) => {
        const x = e.rows[k]?.[y];
        if (x === undefined) throw new Error(`missing ${k} ${y} in ${e.id}`);
        return M(x);
      };
      return {
        year: Number(y),
        preliminary: e.preliminary.includes(y),
        editionId: e.id,
        sourceUrl: e.url,
        receipts: {
          employedPrivate: v('privateEmployees'),
          employedPublic: v('publicEmployees'),
          employeeEmployerSplit: 'unavailable',
          selfEmployed: v('selfEmployed'),
          voluntary: v('voluntary'),
          state: v('state'),
          interest: v('interest'),
          other: v('otherIncome'),
          total: v('totalIncome'),
        },
        expenditure: {
          pensions: v('pensions'),
          pensionsByType: 'unavailable',
          otherBenefits: v('otherBenefits'),
          medical: v('medical'),
          administrative: v('admin'),
          total: v('totalExpenditure'),
        },
        balance: v('balance'),
        reserveOpening: v('reserveOpening'),
        reserveClosing: v('reserveClosing'),
        reserveNature: 'accounting-reserve-deposited-with-government',
      };
    });
}

/** Contributions paid by insured persons and employers (excludes the state share). */
export const contributionsExclState = (y: FundYear) =>
  y.receipts.employedPrivate + y.receipts.employedPublic + y.receipts.selfEmployed + y.receipts.voluntary;

export interface FundCheck {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

/** Rounding tolerance: tables are in €000, so sums may differ by ±€1k (= €0.001m). */
const TOL = 0.0015;

export function checkFundAccounts(series: readonly FundYear[] = fundSeries()): FundCheck[] {
  const out: FundCheck[] = [];
  for (const y of series) {
    const r = y.receipts;
    const e = y.expenditure;
    const inc =
      r.employedPrivate +
      r.employedPublic +
      r.selfEmployed +
      r.voluntary +
      r.state +
      r.interest +
      r.other -
      r.total;
    const exp = e.pensions + e.otherBenefits + e.medical + e.administrative - e.total;
    const bal = r.total - e.total - y.balance;
    const res = y.reserveOpening + y.balance - y.reserveClosing;
    out.push({
      name: `${y.year}: receipts, expenditure, balance and reserve reconcile (±€1k)`,
      pass: [inc, exp, bal, res].every((d) => Math.abs(d) <= TOL),
      detail: `deviations €m: receipts ${inc.toFixed(3)}, expenditure ${exp.toFixed(3)}, balance ${bal.toFixed(3)}, reserve ${res.toFixed(3)}`,
    });
  }
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1]!;
    const b = series[i]!;
    const d = b.reserveOpening - a.reserveClosing;
    out.push({
      name: `${a.year}→${b.year}: closing reserve carries forward`,
      pass: b.year === a.year + 1 && Math.abs(d) <= TOL,
      detail: `difference €${(d * 1000).toFixed(0)}k`,
    });
  }
  return out;
}

/** Every published value of one item for one year, in publication order (revision history). */
export function revisionHistory(
  item: FundItem,
  year: number,
): { editionId: string; value: number; preliminary: boolean }[] {
  return fundEditions()
    .filter((e) => e.language === 'el' && e.years.includes(String(year)))
    .map((e) => ({
      editionId: e.id,
      value: M(e.rows[item]![String(year)]!),
      preliminary: e.preliminary.includes(String(year)),
    }));
}

/** Greek vs English editions of the same bulletin: cells that differ (expected: rounding only). */
export function languageDiscrepancies(): {
  edition: string;
  item: FundItem;
  year: string;
  el: number;
  en: number;
}[] {
  const eds = fundEditions();
  const out: { edition: string; item: FundItem; year: string; el: number; en: number }[] = [];
  for (const el of eds.filter((e) => e.language === 'el')) {
    const en = eds.find((e) => e.language === 'en' && e.edition === el.edition);
    if (!en) continue;
    for (const item of FUND_ITEMS)
      for (const y of el.years) {
        const a = el.rows[item]?.[y];
        const b = en.rows[item]?.[y];
        if (a !== b) out.push({ edition: el.edition, item, year: y, el: a ?? NaN, en: b ?? NaN });
      }
  }
  return out;
}
