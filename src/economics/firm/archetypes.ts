/**
 * Three CONSTRUCTED company archetypes. They are NOT observed individual businesses.
 *
 * Starting characteristics come from Cyprus Structural Business Statistics (Eurostat sbs_sc_ovw)
 * for one NACE division and size class. Every field is tagged as:
 *  - observed   : a published SBS cell;
 *  - derived    : a ratio of published cells (e.g. turnover per enterprise);
 *  - assumed    : a company characteristic with no SBS counterpart (capital stock, pay dispersion…);
 *  - behavioural: a behavioural parameter with no Cyprus estimate (profit-shifting mobility).
 * Everything stays user-adjustable through ArchetypeSpec.
 *
 * Known approximations (documented, not hidden):
 *  - SBS does not publish employees or employee benefits by size class for these cells, so the
 *    division-wide employee share and wage per employee are applied to the size-class enterprise.
 *  - The firm's statutory employer contributions are recomputed from salaries with the exact
 *    payroll engine, so its employee compensation differs from SBS "employee benefits expense"
 *    (which also includes voluntary schemes such as provident funds).
 */
import { salaryWith13th } from '../cyprus/earningsAttribution';
import { sbsCell, sizeClassProfile, latestLabourShare, type Cell } from '../data/sbs';
import type { FirmInputs, FirmPolicyConfig } from './firmModel';

export type ProvenanceKind = 'observed' | 'derived' | 'assumed' | 'behavioural';
export interface ProvenancedValue {
  readonly value: number;
  readonly kind: ProvenanceKind;
  readonly source: string;
  readonly note?: string;
}

export interface ArchetypeSpec {
  readonly name: string;
  readonly nace: string;
  readonly size: '10-19' | '20-49' | '50-249' | 'GE250';
  readonly year: '2021' | '2022' | '2023' | '2024';
  /** Pay groups: share of employees and pay multiple of the division's mean wage (assumed). */
  readonly payGroups: readonly {
    readonly label: string;
    readonly share: number;
    readonly multiple: number;
  }[];
  readonly thirteenthSalary: boolean;
  readonly capitalToValueAdded: number;
  readonly depreciationRate: number;
  readonly aiInvestmentShareOfVa: number;
  readonly outsourcedShareOfIntermediate: number;
  readonly lossesBroughtForward: number;
  readonly maxProfitShifting: number;
}

export interface Archetype {
  readonly spec: ArchetypeSpec;
  readonly firm: FirmInputs;
  readonly provenance: Readonly<Record<string, ProvenancedValue>>;
}

const need = (c: Cell, what: string): number => {
  if (c.value === null)
    throw new Error(`SBS cell unavailable for ${what} (${c.status}); choose another size class or year`);
  return c.value;
};

export function buildArchetype(spec: ArchetypeSpec): Archetype {
  const prof = sizeClassProfile(spec.nace, spec.size, spec.year);
  const src = (what: string, size: string = spec.size) =>
    `Eurostat sbs_sc_ovw, CY, ${spec.nace}, size ${size}, ${spec.year}: ${what}`;
  const ent = need(prof.enterprises, 'enterprises');
  const persons = need(prof.personsEmployed, 'persons employed');
  const turnoverM = need(prof.turnover, 'turnover');
  const vaM = need(prof.valueAdded, 'value added');
  const sal = need(sbsCell('SAL_NR', spec.nace, 'TOTAL', spec.year), 'employees (division total)');
  const empAll = need(sbsCell('EMP_NR', spec.nace, 'TOTAL', spec.year), 'persons employed (division total)');
  const wageM = need(
    sbsCell('WAGE_MEUR', spec.nace, 'TOTAL', spec.year),
    'wages and salaries (division total)',
  );
  const shareSum = spec.payGroups.reduce((s, g) => s + g.share, 0);
  const meanMultiple = spec.payGroups.reduce((s, g) => s + g.share * g.multiple, 0) / shareSum;
  if (Math.abs(shareSum - 1) > 1e-9) throw new RangeError('pay group shares must sum to 1');
  if (Math.abs(meanMultiple - 1) > 1e-6)
    throw new RangeError('pay multiples must average to 1 (preserve the observed mean wage)');

  const personsPerEnt = persons / ent;
  const employeeShare = sal / empAll;
  const employees = Math.max(1, Math.round(personsPerEnt * employeeShare));
  const revenue = (turnoverM * 1e6) / ent;
  const gva = (vaM * 1e6) / ent;
  const meanWage = (wageM * 1e6) / sal;
  const capital = spec.capitalToValueAdded * gva;
  const intermediate = Math.max(0, revenue - gva);

  // Allocate integer headcounts to pay groups (largest remainder, preserving the total).
  const raw = spec.payGroups.map((g) => g.share * employees);
  const counts = raw.map(Math.floor);
  let rest = employees - counts.reduce((a, b) => a + b, 0);
  raw
    .map((x, i) => ({ i, r: x - Math.floor(x) }))
    .sort((a, b) => b.r - a.r)
    .forEach(({ i }) => {
      if (rest > 0) {
        counts[i] = (counts[i] ?? 0) + 1;
        rest -= 1;
      }
    });
  const firm: FirmInputs = {
    name: `${spec.name} (constructed from SBS ${spec.nace} ${spec.size}, ${spec.year})`,
    sector: spec.nace,
    hypothetical: true,
    revenue: Math.round(revenue),
    intermediateConsumption: Math.round(intermediate),
    outsourcedLabourCosts: Math.round(spec.outsourcedShareOfIntermediate * intermediate),
    employees: spec.payGroups.map((g, i) => {
      const annual = g.multiple * meanWage;
      return {
        label: g.label,
        headcount: counts[i] ?? 0,
        earnings: spec.thirteenthSalary
          ? salaryWith13th((annual * 12) / 13)
          : salaryWith13th(annual, { thirteenth: 'none' }),
      };
    }),
    depreciation: Math.round(spec.depreciationRate * capital),
    capitalStock: Math.round(capital),
    aiInvestment: Math.round(spec.aiInvestmentShareOfVa * gva),
    lossesBroughtForward: spec.lossesBroughtForward,
    maxProfitShifting: spec.maxProfitShifting,
  };
  const ls = latestLabourShare(spec.nace);
  const provenance: Record<string, ProvenancedValue> = {
    enterprises: { value: ent, kind: 'observed', source: src('ENT_NR') },
    personsPerEnterprise: { value: personsPerEnt, kind: 'derived', source: src('EMP_NR / ENT_NR') },
    employeeShare: {
      value: employeeShare,
      kind: 'derived',
      source: src('SAL_NR / EMP_NR', 'TOTAL'),
      note: 'division-wide share applied to the size class',
    },
    employees: {
      value: employees,
      kind: 'derived',
      source: 'persons per enterprise × employee share, rounded',
    },
    revenue: {
      value: firm.revenue,
      kind: 'derived',
      source: src('NETTUR_MEUR / ENT_NR'),
      note: 'net turnover, not value added',
    },
    grossValueAdded: {
      value: gva,
      kind: 'derived',
      source: src('AV_MEUR / ENT_NR'),
      note: 'value added at factor cost',
    },
    meanWage: {
      value: meanWage,
      kind: 'derived',
      source: src('WAGE_MEUR / SAL_NR', 'TOTAL'),
      note: 'division-wide mean applied to the size class',
    },
    sectorLabourShare: {
      value: ls.value ?? NaN,
      kind: 'derived',
      source: ls.source,
      note: 'employee benefits expense / value added (descriptive)',
    },
    payDispersion: {
      value: spec.payGroups.length,
      kind: 'assumed',
      source: 'assumed pay groups preserving the observed mean wage',
    },
    thirteenthSalary: {
      value: spec.thirteenthSalary ? 1 : 0,
      kind: 'assumed',
      source: 'assumed (common in Cyprus); attributed per Κ.Δ.Π. 289/2010 Reg. 8(3)',
    },
    capitalStock: {
      value: capital,
      kind: 'assumed',
      source: `assumed capital/value-added ratio ${spec.capitalToValueAdded}`,
    },
    depreciation: {
      value: firm.depreciation,
      kind: 'assumed',
      source: `assumed depreciation rate ${spec.depreciationRate}`,
    },
    aiInvestment: {
      value: firm.aiInvestment,
      kind: 'assumed',
      source: `assumed ${spec.aiInvestmentShareOfVa} × value added`,
    },
    outsourcedLabour: {
      value: firm.outsourcedLabourCosts,
      kind: 'assumed',
      source: `assumed ${spec.outsourcedShareOfIntermediate} × intermediate consumption`,
    },
    lossesBroughtForward: { value: spec.lossesBroughtForward, kind: 'assumed', source: 'assumed' },
    maxProfitShifting: {
      value: spec.maxProfitShifting,
      kind: 'behavioural',
      source: 'assumption; no Cyprus estimate',
      note: 'sensitivity range 0–0.6',
    },
  };
  return { spec, firm, provenance };
}

const groups3 = (low: number, mid: number, high: number, sLow: number, sMid: number) => {
  const sHigh = 1 - sLow - sMid;
  const scale = sLow * low + sMid * mid + sHigh * high; // normalise to mean multiple 1
  return [
    { label: 'lower-paid', share: sLow, multiple: low / scale },
    { label: 'middle', share: sMid, multiple: mid / scale },
    { label: 'higher-paid', share: sHigh, multiple: high / scale },
  ];
};

export const ARCHETYPE_SPECS: readonly ArchetypeSpec[] = [
  {
    name: 'Hospitality (accommodation) archetype',
    nace: 'I55',
    size: '50-249',
    year: '2024',
    payGroups: groups3(0.8, 1.3, 2.5, 0.75, 0.2),
    thirteenthSalary: true,
    capitalToValueAdded: 2.5,
    depreciationRate: 0.06,
    aiInvestmentShareOfVa: 0.005,
    outsourcedShareOfIntermediate: 0.05,
    lossesBroughtForward: 0,
    maxProfitShifting: 0.02,
  },
  {
    name: 'Professional services (legal & accounting) archetype',
    nace: 'M69',
    size: '50-249',
    year: '2024',
    payGroups: groups3(0.6, 1.1, 2.8, 0.45, 0.4),
    thirteenthSalary: true,
    capitalToValueAdded: 0.3,
    depreciationRate: 0.15,
    aiInvestmentShareOfVa: 0.03,
    outsourcedShareOfIntermediate: 0.1,
    lossesBroughtForward: 0,
    maxProfitShifting: 0.15,
  },
  {
    name: 'Software & IT (computer programming) archetype',
    nace: 'J62',
    size: '50-249',
    year: '2024',
    payGroups: groups3(0.7, 1.1, 2.6, 0.4, 0.45),
    thirteenthSalary: true,
    capitalToValueAdded: 0.6,
    depreciationRate: 0.2,
    aiInvestmentShareOfVa: 0.08,
    outsourcedShareOfIntermediate: 0.15,
    lossesBroughtForward: 0,
    maxProfitShifting: 0.5,
  },
];

export const ARCHETYPE_MODELS: readonly Archetype[] = ARCHETYPE_SPECS.map(buildArchetype);
export const ARCHETYPES: readonly FirmInputs[] = ARCHETYPE_MODELS.map((a) => a.firm);

/** Labour-share benchmarks for policy F: SBS sector values (descriptive) and the generic 50%. */
export function sbsBenchmarks(codes: readonly string[]): Record<string, number> {
  const out: Record<string, number> = { default: 0.5 };
  for (const c of codes) {
    const s = latestLabourShare(c);
    if (s.value !== null) out[c] = s.value;
  }
  return out;
}

/** Illustrative default policy settings (assumptions; every value is user-editable). */
export const DEFAULT_FIRM_POLICY: FirmPolicyConfig = {
  valueAdded: {
    rate: 0.02,
    minEmployees: 10,
    minGva: 500_000,
    exemptSectors: [],
    baseElasticity: 0.2,
    payrollReplacement: 0,
  },
  labourShare: {
    rate: 0.2,
    benchmarks: { default: 0.5 },
    minEmployees: 10,
    outsourcingCountedAsLabour: 0.5,
    minOperatingMargin: 0.1,
    capShareOfProfit: 0.25,
    baseElasticity: 0.3,
  },
  excessProfit: {
    rate: 0.2,
    normalReturn: 0.06,
    investmentAllowance: 1,
    useLossCarryforward: true,
    shiftingSemiElasticity: 1,
  },
};
