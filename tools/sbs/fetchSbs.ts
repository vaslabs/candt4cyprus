/**
 * Fetch Cyprus Structural Business Statistics (Eurostat sbs_sc_ovw) for selected NACE Rev. 2
 * sections/divisions, all size classes and all available years, keeping Eurostat status flags
 * (confidential, unreliable, estimated, …). Output: src/data/sbsCyprus.json (committed).
 *
 *   npm run data:sbs
 */
import { writeFileSync } from 'node:fs';

const INDICATORS = [
  'ENT_NR',
  'EMP_NR',
  'SAL_NR',
  'AV_MEUR',
  'EXPN_SAL_BEN_MEUR',
  'WAGE_MEUR',
  'SS_COST_MEUR',
  'NETTUR_MEUR',
  'GOS_MEUR',
  'PUR_MEUR',
];
const NACE = [
  'B-S_X_O_S94',
  'C',
  'F',
  'G',
  'H',
  'I',
  'I55',
  'I56',
  'J',
  'J58',
  'J61',
  'J62',
  'J63',
  'L',
  'M',
  'M69',
  'M70',
  'M71',
  'M72',
  'M73',
  'N',
  'K',
  'K64',
  'K65',
  'K66',
];
const URL_BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sbs_sc_ovw';

interface JsonStat {
  id: string[];
  size: number[];
  updated: string;
  value: Record<string, number>;
  status?: Record<string, string>;
  dimension: Record<string, { category: { index: Record<string, number>; label?: Record<string, string> } }>;
  extension?: { status?: { label?: Record<string, string> } };
}

async function main(): Promise<void> {
  const qs = new URLSearchParams({ geo: 'CY', lang: 'EN' });
  for (const i of INDICATORS) qs.append('indic_sbs', i);
  for (const n of NACE) qs.append('nace_r2', n);
  const url = `${URL_BASE}?${qs.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Eurostat ${res.status}`);
  const d = (await res.json()) as JsonStat;
  const keys = d.id.map((dim) => {
    const idx = d.dimension[dim]!.category.index;
    return Object.keys(idx).sort((a, b) => idx[a]! - idx[b]!);
  });
  const records: {
    indicator: string;
    nace: string;
    size: string;
    year: string;
    value: number | null;
    flag: string | null;
  }[] = [];
  const total = d.size.reduce((a, b) => a * b, 1);
  for (let flat = 0; flat < total; flat++) {
    const v = d.value[String(flat)];
    const s = d.status?.[String(flat)];
    if (v === undefined && s === undefined) continue;
    let rem = flat;
    const coord: Record<string, string> = {};
    for (let j = d.id.length - 1; j >= 0; j--) {
      const n = d.size[j]!;
      coord[d.id[j]!] = keys[j]![rem % n]!;
      rem = Math.floor(rem / n);
    }
    records.push({
      indicator: coord.indic_sbs!,
      nace: coord.nace_r2!,
      size: coord.size_emp!,
      year: coord.time!,
      value: v ?? null,
      flag: s ?? null,
    });
  }
  const labels = (dim: string) => d.dimension[dim]!.category.label ?? {};
  const out = {
    source: 'eurostat-sbs-sc-ovw',
    dataset: 'sbs_sc_ovw',
    url,
    updated: d.updated,
    accessed: new Date().toISOString().slice(0, 10),
    flagLabels: d.extension?.status?.label ?? {},
    indicatorLabels: Object.fromEntries(INDICATORS.map((i) => [i, labels('indic_sbs')[i] ?? i])),
    naceLabels: Object.fromEntries(NACE.map((n) => [n, labels('nace_r2')[n] ?? n])),
    sizeLabels: labels('size_emp'),
    records: records.sort((a, b) =>
      (a.indicator + a.nace + a.size + a.year).localeCompare(b.indicator + b.nace + b.size + b.year),
    ),
  };
  writeFileSync('src/data/sbsCyprus.json', JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote src/data/sbsCyprus.json: ${records.length} records, updated ${d.updated}`);
}
void main();
