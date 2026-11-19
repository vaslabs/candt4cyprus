/**
 * Cyprus Structural Business Statistics (Eurostat sbs_sc_ovw), fetched by tools/sbs/fetchSbs.ts.
 *
 * Coverage: the business economy as defined by SBS (industry, construction and market services,
 * NACE B–S excl. O and S94), enterprises as statistical units. It excludes general government,
 * agriculture and households, so SBS value added is NOT national-accounts GVA.
 *
 * Definitions (Eurostat SBS):
 *  - Employee benefits expense (EXPN_SAL_BEN) = wages and salaries + employers' social security
 *    costs (statutory and voluntary). It is the closest SBS concept to compensation of employees
 *    (D1); it excludes the self-employed and working proprietors.
 *  - Value added (AV) is at factor cost.
 *  - Labour share (derived) = EXPN_SAL_BEN / AV. A wages-only share (WAGE / AV) understates
 *    compensation by the employer social charges and is reported only for comparison.
 * Cells marked confidential ('|C') or missing are never imputed; derived values become null with a
 * stated reason.
 */
import sbsJson from '../../data/sbsCyprus.json';
import { z } from 'zod';

const schema = z.object({
  source: z.string(),
  dataset: z.literal('sbs_sc_ovw'),
  url: z.url(),
  updated: z.string(),
  accessed: z.string(),
  flagLabels: z.record(z.string(), z.string()),
  naceLabels: z.record(z.string(), z.string()),
  records: z.array(
    z.object({
      indicator: z.string(),
      nace: z.string(),
      size: z.string(),
      year: z.string(),
      value: z.number().nullable(),
      flag: z.string().nullable(),
    }),
  ),
});
export type SbsData = z.infer<typeof schema>;

let cache: { data: SbsData; index: Map<string, SbsData['records'][number]> } | null = null;
export function sbs(): { data: SbsData; index: Map<string, SbsData['records'][number]> } {
  if (!cache) {
    const data = schema.parse(sbsJson);
    const index = new Map(data.records.map((r) => [`${r.indicator}|${r.nace}|${r.size}|${r.year}`, r]));
    cache = { data, index };
  }
  return cache;
}

export type CellStatus = 'ok' | 'confidential' | 'missing' | 'flagged';
export interface Cell {
  readonly value: number | null;
  readonly status: CellStatus;
  readonly flag: string | null;
}

export function sbsCell(indicator: string, nace: string, size: string, year: string): Cell {
  const r = sbs().index.get(`${indicator}|${nace}|${size}|${year}`);
  if (!r) return { value: null, status: 'missing', flag: null };
  if (r.flag?.includes('C')) return { value: null, status: 'confidential', flag: r.flag };
  if (r.value === null) return { value: null, status: 'missing', flag: r.flag };
  return { value: r.value, status: r.flag ? 'flagged' : 'ok', flag: r.flag };
}

export const SBS_YEARS = ['2021', '2022', '2023', '2024'] as const;

export interface SectorLabourShare {
  readonly nace: string;
  readonly label: string;
  readonly year: string;
  /** Employee benefits expense / value added (null if not derivable). */
  readonly value: number | null;
  /** Wages and salaries / value added, for comparison (understates compensation). */
  readonly wagesOnly: number | null;
  readonly status: 'derived' | 'unavailable';
  readonly reason: string;
  readonly source: string;
}

/** Labour share for a NACE code and year (size class TOTAL unless given). */
export function sectorLabourShare(nace: string, year: string, size = 'TOTAL'): SectorLabourShare {
  const ben = sbsCell('EXPN_SAL_BEN_MEUR', nace, size, year);
  const va = sbsCell('AV_MEUR', nace, size, year);
  const wage = sbsCell('WAGE_MEUR', nace, size, year);
  const label = sbs().data.naceLabels[nace] ?? nace;
  const source = `Eurostat sbs_sc_ovw (updated ${sbs().data.updated.slice(0, 10)}), CY, ${nace}, ${size}, ${year}`;
  if (ben.value === null || va.value === null || !(va.value > 0)) {
    const reason = `employee benefits ${ben.status}, value added ${va.status}${va.value !== null && !(va.value > 0) ? ' (non-positive)' : ''}`;
    return { nace, label, year, value: null, wagesOnly: null, status: 'unavailable', reason, source };
  }
  return {
    nace,
    label,
    year,
    value: ben.value / va.value,
    wagesOnly: wage.value !== null ? wage.value / va.value : null,
    status: 'derived',
    reason:
      ben.status === 'flagged' || va.status === 'flagged'
        ? 'derived from flagged cells'
        : 'derived from published cells',
    source,
  };
}

/** Latest year for which the labour share is derivable. */
export function latestLabourShare(nace: string, size = 'TOTAL'): SectorLabourShare {
  for (const y of [...SBS_YEARS].reverse()) {
    const s = sectorLabourShare(nace, y, size);
    if (s.value !== null) return s;
  }
  return sectorLabourShare(nace, '2024', size); // latest SBS year; returns status 'unavailable' with reason
}

/** Sector benchmarks for policy F (descriptive defaults, NOT optimal thresholds), keyed by NACE section. */
export function sectorBenchmarks(sections: readonly string[]): Record<string, SectorLabourShare> {
  return Object.fromEntries(sections.map((n) => [n, latestLabourShare(n)]));
}

export interface SizeClassProfile {
  readonly nace: string;
  readonly size: string;
  readonly year: string;
  readonly enterprises: Cell;
  readonly personsEmployed: Cell;
  readonly turnover: Cell;
  readonly valueAdded: Cell;
}

export function sizeClassProfile(nace: string, size: string, year: string): SizeClassProfile {
  return {
    nace,
    size,
    year,
    enterprises: sbsCell('ENT_NR', nace, size, year),
    personsEmployed: sbsCell('EMP_NR', nace, size, year),
    turnover: sbsCell('NETTUR_MEUR', nace, size, year),
    valueAdded: sbsCell('AV_MEUR', nace, size, year),
  };
}
